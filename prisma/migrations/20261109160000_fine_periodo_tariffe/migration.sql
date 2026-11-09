ALTER TABLE "TariffaCollaboratore" ADD COLUMN "validaAlMese" TEXT;
ALTER TABLE "TariffaCollaboratore" ADD CONSTRAINT "TariffaCollaboratore_periodo_valido"
CHECK ("validaAlMese" IS NULL OR "validaAlMese" >= "validaDalMese");
