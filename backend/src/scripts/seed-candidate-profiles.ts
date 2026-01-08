import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding CandidateProfiles...');

    // Get Karnataka state
    const state = await prisma.geoUnit.findFirst({
        where: { name: 'Karnataka', level: 'STATE' }
    });

    if (!state) {
        console.error('Karnataka state not found. Please seed GeoUnits first.');
        return;
    }

    // Get all candidates
    const candidates = await prisma.candidate.findMany({
        include: { party: true }
    });

    for (const candidate of candidates) {
        // Check if profile already exists
        const existing = await prisma.candidateProfile.findUnique({
            where: { candidateId: candidate.id }
        });

        if (existing) {
            console.log(`Profile already exists for ${candidate.fullName}`);
            continue;
        }

        // Create profile
        await prisma.candidateProfile.create({
            data: {
                candidateId: candidate.id,
                primaryGeoUnitId: state.id, // Using state as fallback until constituencies are seeded
                partyId: candidate.partyId,
                isSelf: false, // None are linked to actual users yet
                importanceWeight: 1.0
            }
        });

        console.log(`✅ Created profile for ${candidate.fullName} → ${state.name}`);
    }

    console.log(`Seeding complete! ${candidates.length} profiles created/verified.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
