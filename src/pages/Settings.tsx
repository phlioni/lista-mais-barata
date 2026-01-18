import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarKey, setAvatarKey] = useState(Date.now());
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (user) loadProfile();
    }, [user]);

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user!.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setDisplayName(data.display_name || "");
                if (data.avatar_url) {
                    // Adiciona timestamp para forçar o navegador a baixar a imagem mais recente
                    setAvatarUrl(`${data.avatar_url}?t=${Date.now()}`);
                }
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setLoading(false);
        }
    };

    // Função para limpar imagens antigas (Evita encher o banco)
    const clearUserAvatarFolder = async (userId: string) => {
        try {
            const { data: files } = await supabase.storage.from('avatars').list(userId);
            if (files && files.length > 0) {
                const filesToRemove = files.map(f => `${userId}/${f.name}`);
                await supabase.storage.from('avatars').remove(filesToRemove);
            }
        } catch (error) {
            console.error("Erro ao limpar pasta:", error);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const file = event.target.files?.[0];
            if (!file) return;

            // 1. Limpa qualquer imagem anterior para não encher o storage
            await clearUserAvatarFolder(user!.id);

            // 2. Prepara o novo upload
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar-${Date.now()}.${fileExt}`; // Nome único
            const filePath = `${user!.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 3. Gera a URL Pública
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            const publicUrl = data.publicUrl;
            const displayUrl = `${publicUrl}?t=${Date.now()}`; // URL com cache buster para visualização imediata

            setAvatarUrl(displayUrl);
            setAvatarKey(Date.now()); // Força o componente visual a atualizar

            toast({ title: "Foto carregada!", description: "Clique em Salvar para confirmar." });

        } catch (error) {
            console.error("Error uploading avatar:", error);
            toast({ title: "Erro no upload", description: "Tente uma imagem JPG ou PNG menor.", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Salva no banco a URL "limpa" (sem o ?t=...)
            const cleanUrl = avatarUrl.split('?')[0];

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: displayName,
                    avatar_url: cleanUrl,
                    email: user.email
                });

            if (error) throw error;

            toast({ title: "Perfil atualizado!", description: "Suas informações foram salvas." });
            navigate("/");
        } catch (error) {
            console.error("Error updating profile:", error);
            toast({ title: "Erro ao salvar", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
                <h1 className="text-xl font-display font-bold">Configurações</h1>
            </div>

            <main className="p-6 max-w-md mx-auto space-y-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        {/* key força re-render. crossOrigin ajuda no mobile */}
                        <Avatar key={avatarKey} className="w-32 h-32 border-4 border-background shadow-xl">
                            <AvatarImage
                                src={avatarUrl}
                                className="object-cover w-full h-full"
                                crossOrigin="anonymous"
                            />
                            <AvatarFallback className="text-4xl bg-muted"><User /></AvatarFallback>
                        </Avatar>
                        <label
                            htmlFor="avatar-upload"
                            className="absolute bottom-0 right-0 p-2.5 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:bg-primary/90 transition-colors"
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                            <input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarUpload}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                    <p className="text-sm text-muted-foreground">Toque no ícone para alterar a foto</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome de Exibição</Label>
                        <Input
                            id="name"
                            placeholder="Como você quer ser chamado?"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="h-12 rounded-xl"
                        />
                        <p className="text-xs text-muted-foreground">Este nome aparecerá no ranking mensal.</p>
                    </div>

                    <div className="pt-4">
                        <Button
                            onClick={handleSave}
                            className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Salvar Alterações
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}