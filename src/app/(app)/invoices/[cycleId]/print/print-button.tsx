"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      พิมพ์ทั้งหมด
    </Button>
  );
}
