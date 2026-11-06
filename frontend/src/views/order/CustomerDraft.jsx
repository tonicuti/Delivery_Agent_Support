import { useState } from "react";
import { Copy, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { useMeta } from "@/context.jsx";

/** The assistant drafts the customer message in Swedish, Norwegian or Danish; a dispatcher edits and sends it elsewhere. */
export default function CustomerDraft({ order }) {
  const { languages } = useMeta();
  const [language, setLanguage] = useState("sv");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const checked = order.promised_to_utc != null;

  async function draft() {
    setBusy(true);
    try {
      const result = await api.post(`/api/orders/${order.order_id}/customer-message`, { language });
      setText(result.message);
    } catch {
      toast.error("The assistant could not write a draft just now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste it into your usual channel.");
    } catch {
      toast.error("Your browser blocked copying. Select the text and copy it yourself.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="size-4" aria-hidden="true" />Message to the customer</CardTitle>
        <CardDescription>A draft for you to edit before sending. It will not promise a new delivery time.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="draft-language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="draft-language" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(languages).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={draft} disabled={busy || !checked}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {busy ? "Writing…" : text ? "Write again" : "Write a draft"}
          </Button>
        </div>
        {!checked && <p className="text-xs text-muted-foreground">Check the order first, so there is a delivery promise to refer to.</p>}
        {text && (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Draft message" maxLength={1200} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Read it through and change anything you like.</p>
              <Button size="sm" variant="outline" onClick={copy}><Copy aria-hidden="true" />Copy</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
