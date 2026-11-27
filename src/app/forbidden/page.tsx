import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#7655D9]">403</p>
        <h1 className="mt-3 text-3xl font-black text-[#17152A]">You do not have access</h1>
        <p className="mt-3 text-[#77758A]">This area is restricted by your account permissions.</p>
        <Link className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#35216B] px-5 font-semibold text-white" href="/dashboard">Return to dashboard</Link>
      </div>
    </main>
  );
}
