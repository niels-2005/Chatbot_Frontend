"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"; // Neu: Für Checkboxen
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Neu: Für Dropdown
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon, // Geändert: CpuIcon hinzufügen
  PaperclipIcon,
  StopIcon,
} from "./icons"; // Geändert: CpuIcon importieren
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  // Neu: State für Checkboxen (leicht erweiterbar)
  const [knowledgeLevel, setKnowledgeLevel] = useState<string[]>([]);
  const [writingStyle, setWritingStyle] = useState<string[]>([]);

  const knowledgeOptions = [
    { id: "none", label: "Keine Erfahrung" },
    { id: "medium", label: "Mittlere Erfahrung" },
    { id: "hard", label: "Mach es mir schwer" },
  ];

  const styleOptions = [
    { id: "scientific", label: "Wissenschaftlich" },
    { id: "polite", label: "Höflich" },
  ];

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {/* Neu: Personalisierung-Button mit Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Personalisierung"
            className="ml-auto h-8 w-8 p-0"
            size="sm"
            variant="ghost"
          >
            <CpuIcon size={16} /> {/* Geändert: CpuIcon statt SettingsIcon */}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Wissenstand Modul</DropdownMenuLabel>
          {knowledgeOptions.map((option) => (
            <DropdownMenuItem
              className="flex items-center space-x-2"
              key={option.id}
            >
              <Checkbox
                checked={knowledgeLevel.includes(option.id)}
                id={option.id}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setKnowledgeLevel([...knowledgeLevel, option.id]);
                  } else {
                    setKnowledgeLevel(
                      knowledgeLevel.filter((id) => id !== option.id)
                    );
                  }
                }}
              />
              <label
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor={option.id}
              >
                {option.label}
              </label>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>KI Schreibstil</DropdownMenuLabel>
          {styleOptions.map((option) => (
            <DropdownMenuItem
              className="flex items-center space-x-2"
              key={option.id}
            >
              <Checkbox
                checked={writingStyle.includes(option.id)}
                id={option.id}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setWritingStyle([...writingStyle, option.id]);
                  } else {
                    setWritingStyle(
                      writingStyle.filter((id) => id !== option.id)
                    );
                  }
                }}
              />
              <label
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor={option.id}
              >
                {option.label}
              </label>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Entfernt: New Chat Button */}
      {/* {(!open || windowWidth < 768) && (
        <Button
          className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          variant="outline"
        >
          <PlusIcon />
          <span className="md:sr-only">New Chat</span>
        </Button>
      )} */}

      {/* Entfernt: VisibilitySelector */}
      {/* {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          className="order-1 md:order-2"
          selectedVisibilityType={selectedVisibilityType}
        />
      )} */}

      {/* Entfernt: Deploy with Vercel Button */}
      {/* <Button
        asChild
        className="order-3 hidden bg-zinc-900 px-2 text-zinc-50 hover:bg-zinc-800 md:ml-auto md:flex md:h-fit dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Link
          href={"https://vercel.com/templates/next.js/nextjs-ai-chatbot"}
          rel="noreferrer"
          target="_noblank"
        >
          Deploy with Vercel
        </Link>
        </Button> */}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
