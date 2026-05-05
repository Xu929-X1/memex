-- CreateTable
CREATE TABLE "BrowserExtensionPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackURLs" TEXT[],

    CONSTRAINT "BrowserExtensionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserExtensionPreference_userId_key" ON "BrowserExtensionPreference"("userId");

-- AddForeignKey
ALTER TABLE "BrowserExtensionPreference" ADD CONSTRAINT "BrowserExtensionPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
