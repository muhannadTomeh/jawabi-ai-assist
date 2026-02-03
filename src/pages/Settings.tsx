import { useState } from 'react';
import { Save, Bot, MessageSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockChatbot, mockHandoverSettings } from '@/data/mockData';

export default function SettingsPage() {
  const [botName, setBotName] = useState(mockChatbot.name);
  const [language, setLanguage] = useState(mockChatbot.language);
  const [tone, setTone] = useState(mockChatbot.tone);
  const [fallbackMessage, setFallbackMessage] = useState(mockChatbot.fallbackMessage);
  
  const [handoverEnabled, setHandoverEnabled] = useState(mockHandoverSettings.enabled);
  const [lowConfidence, setLowConfidence] = useState(mockHandoverSettings.triggerOnLowConfidence);
  const [keywords, setKeywords] = useState(mockHandoverSettings.triggerKeywords.join(', '));
  const [handoverMessage, setHandoverMessage] = useState(mockHandoverSettings.handoverMessage);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Configure your chatbot behavior and responses
          </p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Bot className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Human Handover
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="mb-6 flex items-center gap-2 font-semibold text-foreground">
              <Bot className="h-5 w-5 text-primary" />
              Bot Configuration
            </h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Bot Name</Label>
                <Input
                  id="name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g., Support Assistant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Conversation Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fallback">Fallback Message</Label>
                <Textarea
                  id="fallback"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  rows={3}
                  placeholder="Message shown when the bot doesn't understand..."
                />
                <p className="text-xs text-muted-foreground">
                  This message is sent when the chatbot cannot understand the user's request.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Handover Settings */}
        <TabsContent value="handover" className="space-y-6">
          <div className="card-elevated p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Human Handover</h3>
              </div>
              <Switch
                checked={handoverEnabled}
                onCheckedChange={setHandoverEnabled}
              />
            </div>

            <div className={handoverEnabled ? 'space-y-6' : 'pointer-events-none opacity-50 space-y-6'}>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium text-foreground">Trigger on Low Confidence</p>
                  <p className="text-sm text-muted-foreground">
                    Hand over when the bot is unsure about its response
                  </p>
                </div>
                <Switch
                  checked={lowConfidence}
                  onCheckedChange={setLowConfidence}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Trigger Keywords</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="human, agent, support"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated keywords that trigger handover when detected
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="handoverMsg">Handover Message</Label>
                <Textarea
                  id="handoverMsg"
                  value={handoverMessage}
                  onChange={(e) => setHandoverMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Message sent to the user when being transferred to a human
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
