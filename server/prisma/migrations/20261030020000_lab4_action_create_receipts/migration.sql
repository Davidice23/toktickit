-- Additive, private retry receipt; existing Actions are not rewritten.
CREATE TABLE "ActionCreateReceipt" (
  "actionId" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  CONSTRAINT "ActionCreateReceipt_pkey" PRIMARY KEY ("actionId")
);

ALTER TABLE "ActionCreateReceipt" ADD CONSTRAINT "ActionCreateReceipt_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
