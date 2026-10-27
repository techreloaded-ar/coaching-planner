-- CreateTable
CREATE TABLE "PromemoriaFineMeseInviato" (
    "collaboratoreId" TEXT NOT NULL,
    "mese" TEXT NOT NULL,
    "inviatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromemoriaFineMeseInviato_pkey" PRIMARY KEY ("collaboratoreId","mese")
);

-- AddForeignKey
ALTER TABLE "PromemoriaFineMeseInviato" ADD CONSTRAINT "PromemoriaFineMeseInviato_collaboratoreId_fkey" FOREIGN KEY ("collaboratoreId") REFERENCES "Collaboratore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
