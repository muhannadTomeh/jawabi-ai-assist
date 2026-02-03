import { Plus, Search, FileText, MessageCircle, File, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockKnowledgeItems } from '@/data/mockData';

const typeIcons = {
  text: FileText,
  faq: MessageCircle,
  file: File,
};

const typeLabels = {
  text: 'Text Content',
  faq: 'FAQ',
  file: 'File',
};

export default function KnowledgeBasePage() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
          <p className="mt-1 text-muted-foreground">
            Add content for your chatbot to learn from
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Content
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search knowledge base..."
          className="pl-10"
        />
      </div>

      {/* Content List */}
      <div className="space-y-3">
        {mockKnowledgeItems.map((item) => {
          const Icon = typeIcons[item.type];
          return (
            <div
              key={item.id}
              className="card-elevated flex items-center gap-4 p-4 transition-all hover:shadow-md"
            >
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {typeLabels[item.type]}
                  {item.type === 'faq' && item.question && (
                    <span className="ml-1">• {item.question}</span>
                  )}
                  {item.type === 'file' && item.fileName && (
                    <span className="ml-1">• {item.fileName}</span>
                  )}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* Empty State (hidden when items exist) */}
      {mockKnowledgeItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-foreground">No content yet</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Add FAQs, text content, or upload files to train your chatbot
          </p>
          <Button className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Add Content
          </Button>
        </div>
      )}
    </div>
  );
}
