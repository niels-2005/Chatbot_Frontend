"use server";

import ollama from "ollama"; // Neu: Ollama importieren
import { cookies } from "next/headers";
import type { UIMessage } from "ai"; // Behalte type UIMessage, entferne generateText
// Entferne: import { generateText, type UIMessage } from "ai";
// Entferne: import { myProvider } from "@/lib/ai/providers";
import type { VisibilityType } from "@/components/visibility-selector";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils"; // Neu: Für UUID

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  // Für Tests: Fester Titel mit UUID
  return "Big Data und Data Science";
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}