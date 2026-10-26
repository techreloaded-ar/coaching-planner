-- CreateTable
CREATE TABLE "CollegamentoCalendarioGoogle" (
    "id" TEXT NOT NULL,
    "collaboratoreId" TEXT NOT NULL,
    "refreshTokenCifrato" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollegamentoCalendarioGoogle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCalendarioGestito" (
    "id" TEXT NOT NULL,
    "collaboratoreId" TEXT NOT NULL,
    "eventoCalendarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCalendarioGestito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollegamentoCalendarioGoogle_collaboratoreId_key" ON "CollegamentoCalendarioGoogle"("collaboratoreId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoCalendarioGestito_collaboratoreId_eventoCalendarioId_key" ON "EventoCalendarioGestito"("collaboratoreId", "eventoCalendarioId");

-- AddForeignKey
ALTER TABLE "CollegamentoCalendarioGoogle" ADD CONSTRAINT "CollegamentoCalendarioGoogle_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCalendarioGestito" ADD CONSTRAINT "EventoCalendarioGestito_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
