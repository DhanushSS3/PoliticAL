"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Seeding CandidateProfiles...");
    const state = await prisma.geoUnit.findFirst({
        where: { name: "Karnataka", level: "STATE" },
    });
    if (!state) {
        console.error("Karnataka state not found. Please seed GeoUnits first.");
        return;
    }
    const candidates = await prisma.candidate.findMany({
        include: { party: true },
    });
    for (const candidate of candidates) {
        const existing = await prisma.candidateProfile.findUnique({
            where: { candidateId: candidate.id },
        });
        if (existing) {
            console.log(`Profile already exists for ${candidate.fullName}`);
            continue;
        }
        await prisma.candidateProfile.create({
            data: {
                candidateId: candidate.id,
                primaryGeoUnitId: state.id,
                partyId: candidate.partyId,
                isSelf: false,
                importanceWeight: 1.0,
            },
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
//# sourceMappingURL=seed-candidate-profiles.js.map