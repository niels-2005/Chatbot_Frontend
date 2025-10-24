"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const allSuggestions = [
    "Was versteht man unter Overfitting?",
    "Wie unterscheiden sich Streaming- und Batch-Verarbeitung bei Big Data?",
    "Wie funktioniert GridSearchCV und wann setze ich es ein?",
    "Wie kann ich fehlende Werte in einem Datensatz behandeln?",
    "Was ist der Unterschied zwischen Supervised und Unsupervised Learning?",
    "Wie funktioniert die Hauptkomponentenanalyse (PCA)?",
    "Was bedeutet der Epizyklus der Datenanalyse?",
    "Wie gehe ich mit Ausreißern um?",
    "Was unterscheidet Ridge- von Lasso-Regression?",
    "Wie interpretiere ich eine Konfusionsmatrix?",
    "Wann ist eine NoSQL-Datenbank sinnvoll?",
    "Wie funktioniert K-Means-Clustering?",
    "Was sind typische Arten von Daten?",
    "Was ist Apache Spark und wann setze ich es ein?",
    "Wie funktioniert die logistische Regression?",
    "Was macht eine gute Datenvisualisierung aus?",
    "Was ist eine Pipeline in scikit-learn?",
    "Was ist das CAP-Theorem?",
    "Wie bestimme ich die optimale Clusteranzahl?",
    "Wie bewerte ich die Qualität von Daten?",
    "Was sind Overfitting und Underfitting?",
    "Wann verwende ich Bagging oder Boosting?",
    "Wie funktioniert ein Decision Tree?",
    "Wie funktioniert die Ridge-Regression?",
    "Was ist Feature Engineering?",
    "Wie kann ich Textdaten klassifizieren?",
    "Wie kann ich mehrere Datenquellen verknüpfen?",
    "Was sind Ausreißer und wie erkenne ich sie?",
    "Was ist der Unterschied zwischen OLTP und OLAP?",
    "Wie funktioniert die Kappa-Architektur?",
    "Wie arbeite ich mit dem Titanic-Datensatz?",
    "Was misst die ROC-AUC-Metrik?",
    "Was ist die LDA bei Topic Mining?",
    "Was ist eine Scatter-Plot-Matrix?",
    "Wie kann ich Daten skalieren?",
    "Was sind typische Visualisierungen für kategoriale Daten?",
    "Was ist eine hierarchische Clusteranalyse?",
    "Wie wähle ich ein geeignetes ML-Modell aus?",
    "Wie funktioniert GridSearchCV?",
    "Wie kann ich Regularisierung verstehen?",
    "Was ist der Unterschied zwischen strukturierten und unstrukturierten Daten?",
    "Wie kann ich Korrelationsplots interpretieren?",
    "Was ist Apache Kafka?",
    "Wie funktioniert Streaming in Echtzeit?",
    "Was sind RDDs und DataFrames?",
    "Wann verwende ich eine Document-DB wie MongoDB?",
    "Was ist eine Violin-Plot-Darstellung?",
    "Wie funktioniert ein Pair-Plot?",
    "Was sind die Schritte der Datenanalyse?",
    "Was bedeutet Datenqualität?",
  ];

  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);

  // Nur im Client ausführen → verhindert Hydration-Fehler
  useEffect(() => {
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
    setSuggestedActions(shuffled.slice(0, 2));
  }, [chatId]); // bei neuem Chat neu würfeln

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={suggestedAction}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="line-clamp-2 h-15 w-full whitespace-normal p-3 text-center" // Geändert: h-20 für feste Höhe, line-clamp-2 für Textbegrenzung
            onClick={(suggestion) => {
              window.history.replaceState({}, "", `/chat/${chatId}`);
              sendMessage({
                id: generateUUID(),
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    return true;
  }
);
