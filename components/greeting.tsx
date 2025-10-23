"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";

export const Greeting = () => {
  const { data: session } = useSession();
  const firstName =
    session?.user?.firstName && session.user.firstName !== "Guest"
      ? session.user.firstName
      : "";
  const moduleName = "Big Data & Data Science "; // Placeholder, replace with actual module name if available

  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Hallo{firstName ? ` ${firstName}` : ""}! 👋
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        <br />
        Ich begleite dich dabei, die Inhalte des Moduls {moduleName}
        Schritt für Schritt zu verstehen und selbst zu erarbeiten.
        <br />
        <br />
        In den Einstellungen kannst du mein Verhalten individuell anpassen – zum
        Beispiel festlegen, wie dein aktueller Wissensstand im Modul ist und in
        welchem Stil ich dich beim Lernen unterstützen soll.
        <br />
        <br />
        Trotzdem kann es vorkommen, dass ich gelegentlich Fehler mache.
        Hinterfrage meine Antworten daher immer kritisch und überprüfe sie, wenn
        du unsicher bist.
      </motion.div>
    </div>
  );
};
