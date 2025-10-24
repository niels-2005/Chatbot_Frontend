"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const sendMessage = useCallback(async (message: ChatMessage) => {
    setStatus("submitted");
    abortControllerRef.current = new AbortController();

    // URL aktualisieren, wenn wir auf der Root-Page sind
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({}, "", `/chat/${id}`);
    }

    const assistantMessage: ChatMessage = {
      id: generateUUID(),
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    setMessages((prev) => [...prev, message, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          message,
          selectedChatModel: currentModelIdRef.current,
          selectedVisibilityType: visibilityType,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // SSE-Stream verarbeiten
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("Stream completed");
          break;
        }
        
        // Dekodiere Bytes zu Text
        buffer += decoder.decode(value, { stream: true });
        
        // Verarbeite vollständige Zeilen
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Behalte letzte unvollständige Zeile

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6).trim();
            
            // [DONE] Marker
            if (chunk === "[DONE]") {
              console.log("Stream done marker received");
              continue;
            }
            
            // Leere Zeilen überspringen
            if (!chunk) continue;
            
            try {
              const parsed = JSON.parse(chunk);
              
              // Error-Handling
              if (parsed.error) {
                console.error("Stream error:", parsed.error);
                throw new Error(parsed.error);
              }
              
              // Delta-Update
              if (parsed.delta) {
                // Beim ersten Content-Chunk: Status auf "streaming" setzen
                if (isFirstChunk) {
                  setStatus("streaming");
                  isFirstChunk = false;
                }
                
                const firstPart = assistantMessage.parts[0];
                if (firstPart && firstPart.type === 'text') {
                  firstPart.text += parsed.delta;
                  
                  // UI-Update (immutable)
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...assistantMessage };
                    return updated;
                  });
                }
              }
            } catch (parseError) {
              console.warn("Failed to parse SSE data:", chunk, parseError);
              // Continue mit nächster Zeile bei Parse-Fehlern
            }
          }
        }
      }

      // Stream erfolgreich beendet
      setStatus("ready");
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      
    } catch (error: any) {
      // Abort ist kein Fehler
      if (error.name === "AbortError") {
        console.log("Stream aborted by user");
        setStatus("ready");
        return;
      }
      
      // Echter Fehler
      setStatus("error");
      console.error("Send message error:", error);
      toast({
        type: "error",
        description: error.message || "Failed to send message",
      });
      
      // Entferne die fehlerhafte Assistant-Nachricht
      setMessages((prev) => prev.slice(0, -1));
    }
  }, [id, currentModelIdRef, visibilityType, mutate]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      console.log("Aborting stream...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("ready");
  }, []);

  const regenerate = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserMessage = messages[messages.length - 2];
    setMessages((prev) => prev.slice(0, -2)); // Entferne letzte Assistant- und User-Nachricht
    sendMessage(lastUserMessage);
  }, [messages, sendMessage]);

  const resumeStream = useCallback(() => {
    // Vereinfacht: Starte neu, wenn nötig
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        sendMessage(lastMessage);
      }
    }
  }, [messages, sendMessage]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        id: generateUUID(),
        role: "user",
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={() => {}}
        open={false} // Vereinfacht
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}