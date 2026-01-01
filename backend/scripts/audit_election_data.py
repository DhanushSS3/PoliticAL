#!/usr/bin/env python3
"""
Election Data Audit Script

Audits database for data completeness and anomalies.

SCOPE:
- Checks Cartesian product (Election x Constituency) for missing summaries
- Checks for data anomalies (Turnout > 100%, 0 Votes, No Winner)
- Generates CSV report: election_audit_report.csv

REQUIREMENTS:
- DATABASE_URL environment variable
- GeoElectionSummary table populated
"""

import os
import sys
import logging
import csv
from typing import Dict, List, Set, Tuple
import psycopg2
from psycopg2.extensions import connection
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


class ElectionAuditor:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn: Optional[connection] = None
        
        # Caches
        self.elections: Dict[int, int] = {}          # id -> year
        self.constituencies: Dict[int, str] = {}     # id -> name
        
        # Report
        self.issues: List[Dict] = []
        
    def connect_db(self) -> None:
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("[OK] Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"[ERROR] Database connection failed: {e}")
            sys.exit(1)
            
    def load_metadata(self) -> None:
        cursor = self.conn.cursor()
        try:
            # Load Elections
            cursor.execute('SELECT id, year FROM "Election" ORDER BY year')
            self.elections = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Load Constituencies
            cursor.execute('SELECT id, name FROM "GeoUnit" WHERE level = %s ORDER BY name', ('CONSTITUENCY',))
            self.constituencies = {row[0]: row[1] for row in cursor.fetchall()}
            
            logger.info(f"Metadata: {len(self.elections)} elections, {len(self.constituencies)} constituencies")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load metadata: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def run_audit(self) -> None:
        logger.info("Running audit...")
        cursor = self.conn.cursor()
        
        # 1. Fetch all summaries indexed by (electionId, geoUnitId)
        summaries = {}
        try:
            cursor.execute(
                '''
                SELECT 
                    "electionId", 
                    "geoUnitId", 
                    "totalVotesCast", 
                    "turnoutPercent", 
                    "winningCandidate"
                FROM "GeoElectionSummary"
                '''
            )
            for row in cursor.fetchall():
                summaries[(row[0], row[1])] = {
                    'votes': row[2],
                    'turnout': row[3],
                    'winner': row[4]
                }
        except Exception as e:
            logger.error(f"[ERROR] Failed to fetch summaries: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
        # 2. Check Cartesian Product
        total_expected = len(self.elections) * len(self.constituencies)
        logger.info(f"Checking {total_expected} combinations...")
        
        found_count = 0
        missing_count = 0
        anomaly_count = 0
        
        for elect_id, year in self.elections.items():
            for const_id, const_name in self.constituencies.items():
                
                key = (elect_id, const_id)
                summary = summaries.get(key)
                
                elect_name = f"Karnataka Assembly {year}"
                
                if not summary:
                    self.issues.append({
                        'electionId': elect_id,
                        'electionName': elect_name,
                        'constituencyId': const_id,
                        'constituencyName': const_name,
                        'issueType': 'MISSING_SUMMARY'
                    })
                    missing_count += 1
                    continue
                
                found_count += 1
                
                # Check Anomalies
                issues = []
                
                if summary['votes'] == 0:
                    issues.append('ZERO_VOTES')
                
                if summary['turnout'] > 100.0:
                    issues.append(f"TURNOUT_OVER_100 ({summary['turnout']:.2f}%)")
                    
                if not summary['winner']:
                    issues.append('NO_WINNER')
                    
                if issues:
                    anomaly_count += 1
                    for issue in issues:
                        self.issues.append({
                            'electionId': elect_id,
                            'electionName': elect_name,
                            'constituencyId': const_id,
                            'constituencyName': const_name,
                            'issueType': issue
                        })

        logger.info("="*60)
        logger.info("AUDIT COMPLETE")
        logger.info(f"  Total Expected: {total_expected}")
        logger.info(f"  Total Found:    {found_count}")
        logger.info(f"  Missing:        {missing_count}")
        logger.info(f"  Anomalies:      {anomaly_count}")
        logger.info("="*60)
        
    def generate_report(self) -> None:
        filename = 'election_audit_report.csv'
        filepath = os.path.join(os.path.dirname(__file__), filename)
        
        logger.info(f"Generating CSV report: {filename}")
        
        try:
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'electionId', 'electionName', 
                    'constituencyId', 'constituencyName', 
                    'issueType'
                ])
                writer.writeheader()
                writer.writerows(self.issues)
                
            logger.info(f"[OK] Report saved to {filepath}")
            
            # Print sample issues
            if self.issues:
                logger.info("Top 5 Issues Found:")
                for issue in self.issues[:5]:
                    logger.info(f"  - {issue['issueType']}: {issue['constituencyName']} ({issue['electionName']})")
            else:
                logger.info("  Zero issues found! Clean data.")
                
        except Exception as e:
            logger.error(f"[ERROR] Failed to write report: {e}")

    def run(self) -> None:
        try:
            self.connect_db()
            self.load_metadata()
            self.run_audit()
            self.generate_report()
        finally:
            if self.conn:
                self.conn.close()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
        
    auditor = ElectionAuditor(db_url)
    auditor.run()
