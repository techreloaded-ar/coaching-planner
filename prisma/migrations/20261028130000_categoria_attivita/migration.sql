-- CreateEnum
CREATE TYPE "CategoriaAttivita" AS ENUM ('FATTURABILE', 'NON_FATTURABILE', 'INVESTIMENTO');

-- AlterTable
ALTER TABLE "RigaAttivita" ADD COLUMN "categoria" "CategoriaAttivita" NOT NULL DEFAULT 'FATTURABILE';

-- Le righe non fatturabili erano già escluse sia dalla fattura del
-- collaboratore sia da quella al cliente: diventano INVESTIMENTO, così gli
-- importi dei mesi passati non cambiano.
UPDATE "RigaAttivita" SET "categoria" = 'INVESTIMENTO' WHERE "fatturabile" = false;

ALTER TABLE "RigaAttivita" DROP COLUMN "fatturabile";
