import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Card className="w-full max-w-md p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#27B9D6]/15 text-xl text-[#176D80]">@</div>
      <h1 className="mt-5 text-3xl font-black">Check your email</h1>
      <p className="mt-3 text-sm leading-6 text-[#77758A]">Use the verification link in your inbox to finish setting up JOGGLE ME.</p>
      <Link className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#35216B] px-5 font-semibold text-white" href="/login">Return to login</Link>
    </Card>
  );
}
