import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useBackgroundImage } from "@/hooks/useBackgroundImage";
import { Upload, X, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const { backgroundImage, opacity, setBackgroundImage, removeBackground, setOpacity } = useBackgroundImage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await setBackgroundImage(file);
      toast({
        title: "Background updated",
        description: "Your custom background has been applied",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process the image. Please try another file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveBackground = () => {
    removeBackground();
    toast({
      title: "Background removed",
      description: "Default background restored",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-tile max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your CRM preferences and integrations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="company">Company Name</Label>
            <Input id="company" placeholder="Your Company" className="rounded-xl" />
          </div>

          <div className="space-y-3">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" className="rounded-xl" />
          </div>

          <div className="space-y-3">
            <Label>AI Model Settings</Label>
            <div className="p-4 bg-muted/50 rounded-xl space-y-2">
              <p className="text-sm text-muted-foreground">
                AI assistant powered by Gemini 2.5 Flash
              </p>
              <Button variant="outline" className="rounded-xl">
                Configure AI Settings
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Custom Background</Label>
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a background image for your dashboard. Recommended: 1920x1080px or higher, max 5MB
              </p>
              
              {backgroundImage ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <img 
                      src={backgroundImage} 
                      alt="Background preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tile Transparency</Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[opacity * 100]}
                        onValueChange={([value]) => setOpacity(value / 100)}
                        max={100}
                        min={50}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleRemoveBackground}
                    className="rounded-xl w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove Background
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="background-upload"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('background-upload')?.click()}
                    disabled={isUploading}
                    className="rounded-xl w-full"
                  >
                    {isUploading ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Background Image
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Data & Privacy</Label>
            <div className="p-4 bg-muted/50 rounded-xl space-y-2">
              <p className="text-sm text-muted-foreground">
                Your data is encrypted and secure
              </p>
              <Button variant="outline" className="rounded-xl">
                Export Data
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
