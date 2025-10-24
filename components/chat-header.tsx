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
  const [knowledgeLevel, setKnowledgeLevel] = useState<string | null>(null);

  const knowledgeOptions = [
    { id: "none", label: "Keine Erfahrung – Einfache Sprache, viele Beispiele" },
    { id: "base", label: "Grundkenntnisse – Kürzere Erklärungen, gelegentliche Hinweise" },
    { id: "advanced", label: "Fortgeschritten – Fachsprache, Fokus auf Verständnis und Anwendung" },
  ];

  const styleOptions = [
    { id: "scientific", label: "Wissenschaftlich" },
    { id: "casual", label: "Locker" },
    { id: "motivating", label: "Motivierend" },
  ];

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {/* Neu: Personalisierung-Button mit Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Personalisierung"
            className="ml-auto h-8 w-8 p-0 cursor-pointer"
            size="sm"
            variant="ghost"
          >
            <CpuIcon size={16} /> {/* Geändert: CpuIcon statt SettingsIcon */}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-140">
          <DropdownMenuLabel>Wissenstand vom Modul</DropdownMenuLabel>
          {knowledgeOptions.map((option) => (
            <DropdownMenuItem
              className="flex items-center space-x-2"
              key={option.id}
              onSelect={(event) => event.preventDefault()}
            >
              <Checkbox
                checked={knowledgeLevel === option.id}  // Geändert: Einzelne Auswahl prüfen
                id={option.id}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setKnowledgeLevel(option.id);  // Geändert: Setze auf diese ID
                  } else {
                    setKnowledgeLevel(null);  // Geändert: Setze auf null
                  }
                }}
              />
              <label
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                htmlFor={option.id}
              >
                {option.label}
              </label>
            </DropdownMenuItem>
          ))}
          
        </DropdownMenuContent>
      </DropdownMenu>
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
