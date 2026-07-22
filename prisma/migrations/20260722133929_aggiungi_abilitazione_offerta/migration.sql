-- CreateTable
CREATE TABLE "AbilitazioneOfferta" (
    "id" TEXT NOT NULL,
    "collaboratoreId" TEXT NOT NULL,
    "offertaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbilitazioneOfferta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbilitazioneOfferta_collaboratoreId_offertaId_key" ON "AbilitazioneOfferta"("collaboratoreId", "offertaId");

-- AddForeignKey
ALTER TABLE "AbilitazioneOfferta" ADD CONSTRAINT "AbilitazioneOfferta_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilitazioneOfferta" ADD CONSTRAINT "AbilitazioneOfferta_offertaId_fkey" FOREIGN KEY ("offertaId") REFERENCES "Offerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
