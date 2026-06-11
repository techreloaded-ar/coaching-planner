-- CreateEnum
CREATE TYPE "Ruolo" AS ENUM ('AMMINISTRATORE', 'COLLABORATORE');

-- CreateTable
CREATE TABLE "Utente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "ruolo" "Ruolo" NOT NULL DEFAULT 'COLLABORATORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Collaboratore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "partitaIva" TEXT NOT NULL,
    "tariffaGiornaliera" DECIMAL(10,2) NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaboratore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "ragioneSociale" TEXT NOT NULL,
    "partitaIva" TEXT,
    "indirizzo" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offerta" (
    "id" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tariffaGiornaliera" DECIMAL(10,2) NOT NULL,
    "giorniPrevisti" INTEGER NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaglioneKm" (
    "id" TEXT NOT NULL,
    "finoAKm" INTEGER NOT NULL,
    "importo" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaglioneKm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RigaAttivita" (
    "id" TEXT NOT NULL,
    "collaboratoreId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "offertaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "ore" DECIMAL(4,2) NOT NULL,
    "nota" TEXT,
    "fatturabile" BOOLEAN NOT NULL DEFAULT true,
    "trasfertaKm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RigaAttivita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utente_email_key" ON "Utente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Collaboratore_userId_key" ON "Collaboratore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Offerta_codice_clienteId_key" ON "Offerta"("codice", "clienteId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboratore" ADD CONSTRAINT "Collaboratore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offerta" ADD CONSTRAINT "Offerta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaAttivita" ADD CONSTRAINT "RigaAttivita_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaAttivita" ADD CONSTRAINT "RigaAttivita_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaAttivita" ADD CONSTRAINT "RigaAttivita_offertaId_fkey" FOREIGN KEY ("offertaId") REFERENCES "Offerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
