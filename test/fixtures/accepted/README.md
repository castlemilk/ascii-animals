# Independently recovered accepted cuttlefish baselines

Test-only snapshots, not package/runtime code. Never update these from a candidate.

- V3: original `ascii-animals-crown-v3.zip`, `changed-files/src/animals/cuttlefish.js`; source commit8931bcc568cb5272f3a7b5eab0532c6c95c92858, SHAcd1dc0d1cb60310afdaa86f2743be336fa97078a464f74511d6bf7af2d0d0f10.
- V5: original `ascii-animals-crown-roots-v5.zip`, `changed-files/src/animals/cuttlefish.js`; commitd638880513978c63b8cb1dfc97101463baa22966, SHAb65cb598f9944c1d89e8564db6707b684632cadcfd416e1365e1eb0bf58071dd.
- V6: original V7.1 archive prerequisite `exact-v6-from-public-main.patch` applied to public mainb8f222dab868821f27bf2a64a98434f3483fc8e6; SHA2dd02aa60ed0503d41f1bbd4d19554a9b37323c11ced16fbd037196b94a1e0f9, matching original V6 commit037cd63b0a34ca0f129b6adedb9ea3d46a8465b8 identity.
- V7: original V7.1 archive `source/v7/src`, accepted private tree88a1a50e9f0691954c214d8a919f825209a38627, SHA815dc158a2013a6590cdfce4d093e5092989eecfd0687ed952948583e56289ba.

All four primary source hashes match the pre-existing independently recorded fixture identities. V3/V5/V6 auxiliary scheduler/manta/octopus modules are from pinned public mainb8f222d; V7 auxiliary modules are from its original archived source. Tests mount only cuttlefish. Every module is verified against sha256.json before import, with primary source hashes additionally pinned in the loader.

Original historical JSON fixtures remain byte-for-byte unchanged. Their metadata/scopes/pose coverage remain asserted. Tests compute expected exact fingerprints in memory from the accepted snapshots on the same runtime as the candidate, avoiding cross-platform libm last-bit differences without rounding or numeric tolerances. They never write a new expected fixture or import candidate geometry as a baseline. Existing source-boundary guards and negative mutation controls remain; additional tests reject a one-byte baseline modification and a one-ULP output change.

No original Linux runtime was recovered or run. This is strict same-runtime independent-source equivalence, not a claim that cross-platform floating-point bits are identical.
