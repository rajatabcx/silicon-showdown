import Link from "next/link";

export const metadata = { title: "Disclaimer · Silicon Showdown" };

export default function Legal() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6 text-white/85">
      <h1 className="text-3xl font-black italic text-white">Disclaimer</h1>
      <p>
        Silicon Showdown is a work of satire and parody. Every character, name, line and event in the game is fictional and
        exaggerated for comedy. Nothing in it is news, and nothing in it is a statement of fact about any real person,
        company, political party or government body.
      </p>
      <p>
        The game is not affiliated with, endorsed by or connected to any person or organisation. Any resemblance to real
        people is caricature for the purpose of commentary.
      </p>
      <p>All music and artwork are original. No real photographs are used.</p>
      <Link href="/" className="underline">Back to the game</Link>
    </main>
  );
}
