import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function standby() {
  return NextResponse.json(
    { error: "test_control_plane_standby", environment: "test", writable: false, message: "Les anciennes commandes du plan de contrôle TEST sont désactivées. Utilisez exclusivement les commandes Aéro Service PRODUCTION." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() { return standby(); }
export async function POST() { return standby(); }
