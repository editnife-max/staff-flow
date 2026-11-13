import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_KINDS,
  PLACEMENTS,
  type ContactItem,
  type ContactKind,
  type Placement,
} from "../config";
import { ContactIcon } from "../icons";
import { Group, Row, Segmented, SortableList } from "./controls";
import { ALIGN_OPTIONS, SLOT_OPTIONS, patch, type PanelProps } from "./types";

const MAX_CONTACTS = 12;

export function ContactsPanel({ config, update }: PanelProps) {
  const contacts = config.contacts;
  const setContacts = (next: ContactItem[]) => update((c) => ({ ...c, contacts: next }));
  const edit = (id: string, p: Partial<ContactItem>) =>
    setContacts(contacts.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const f = config.footer;

  return (
    <div className="space-y-5">
      <Group
        title="Contacts and social media"
        description="Each item gets its icon. Place it in the header or footer, left, centre or right."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={contacts.length >= MAX_CONTACTS}
            onClick={() =>
              setContacts([
                ...contacts,
                {
                  id: crypto.randomUUID().slice(0, 8),
                  kind: "phone",
                  label: "",
                  value: "",
                  placement: "footer-left",
                },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        }
      >
        {contacts.length === 0 ? (
          <p className="border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No contacts yet. Add phone numbers, email, website or social pages.
          </p>
        ) : (
          <SortableList
            items={contacts}
            getId={(x) => x.id}
            onReorder={setContacts}
            className="space-y-2"
            render={(x) => {
              const kind = CONTACT_KINDS.find((k) => k.id === x.kind)!;
              return (
                <div className="space-y-2 border border-border p-2">
                  <div className="flex gap-2">
                    <Select
                      value={x.kind}
                      onValueChange={(v) => edit(x.id, { kind: v as ContactKind })}
                    >
                      <SelectTrigger
                        className="h-8 w-40 shrink-0 text-xs"
                        aria-label="Type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_KINDS.map((k) => {
                          return (
                            <SelectItem key={k.id} value={k.id} className="text-xs">
                              <span className="flex items-center gap-2">
                                <ContactIcon kind={k.id} size={14} color="currentColor" /> {k.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Input
                      value={x.value}
                      maxLength={80}
                      placeholder={kind.placeholder}
                      onChange={(e) => edit(x.id, { value: e.target.value })}
                      className="h-8 text-xs"
                      aria-label="Value"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setContacts(contacts.filter((c) => c.id !== x.id))}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={x.label}
                      maxLength={24}
                      placeholder="Label (optional), e.g. Office"
                      onChange={(e) => edit(x.id, { label: e.target.value })}
                      className="h-8 text-xs"
                      aria-label="Label"
                    />
                    <Select
                      value={x.placement}
                      onValueChange={(v) => edit(x.id, { placement: v as Placement })}
                    >
                      <SelectTrigger
                        className="h-8 w-40 shrink-0 text-xs"
                        aria-label="Placement"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACEMENTS.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!x.value.trim() && (
                    <p className="text-[11px] text-amber-600">Empty items aren't printed.</p>
                  )}
                </div>
              );
            }}
          />
        )}
      </Group>

      <Group title="Footer">
        <Row label="Show footer">
          <Switch checked={f.show} onCheckedChange={(v) => update(patch("footer", { show: v }))} />
        </Row>
        {f.show && (
          <>
            <Row label="Style">
              <Segmented
                label="Footer style"
                value={f.style}
                onChange={(v) => update(patch("footer", { style: v }))}
                options={[
                  { value: "band", label: "Coloured band" },
                  { value: "line", label: "Top rule" },
                  { value: "plain", label: "Plain" },
                ]}
              />
            </Row>
            <Row label="Company name" hint="Printed small in the footer">
              <Segmented
                label="Footer company position"
                value={f.companyPosition}
                onChange={(v) => update(patch("footer", { companyPosition: v }))}
                options={SLOT_OPTIONS}
              />
            </Row>
            <Input
              value={f.note}
              maxLength={120}
              placeholder="Footer note (optional), e.g. Licence No. 123/2024 · Addis Ababa"
              onChange={(e) => update(patch("footer", { note: e.target.value }))}
             
            />
            {f.note.trim() && (
              <Row label="Note position">
                <Segmented
                  label="Note position"
                  value={f.notePosition}
                  onChange={(v) => update(patch("footer", { notePosition: v }))}
                  options={ALIGN_OPTIONS}
                />
              </Row>
            )}
          </>
        )}
      </Group>
    </div>
  );
}
