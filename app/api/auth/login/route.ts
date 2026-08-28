import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  const origin = request.nextUrl.origin;

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "Correo o contraseña incorrectos.");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/dashboard", origin), 303);
}
