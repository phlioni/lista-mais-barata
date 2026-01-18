import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    MapPin, Heart, MessageCircle, Send, Loader2, Store, Plus, Image as ImageIcon, X, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ... (Interfaces Post, Comment, MarketSimple mantidas iguais ao anterior) ...
interface Post {
    id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    distance_km: number;
    user_id: string;
    author_name: string;
    author_avatar: string;
    market_id: string | null;
    market_name: string | null;
    market_address: string | null;
    likes_count: number;
    comments_count: number;
    liked_by_me: boolean;
}

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: {
        display_name: string | null;
        avatar_url: string | null;
    } | null;
}

interface MarketSimple {
    id: string;
    name: string;
    address: string;
}

export default function Community() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [sessionTimestamp] = useState(Date.now());
    const getSecureUrl = (url: string | null | undefined) => {
        if (!url) return undefined;
        return `${url}${url.includes('?') ? '&' : '?'}t=${sessionTimestamp}`;
    };

    // Estados
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

    // Criar Post
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newContent, setNewContent] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);

    // Menção
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [marketSuggestions, setMarketSuggestions] = useState<MarketSimple[]>([]);
    const [linkedMarket, setLinkedMarket] = useState<MarketSimple | null>(null);

    // Comentários
    const [activePostForComments, setActivePostForComments] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newCommentText, setNewCommentText] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);

    // 1. GPS
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
                () => {
                    toast({ title: "GPS necessário", description: "Ative a localização.", variant: "destructive" });
                    setLoading(false);
                }
            );
        } else setLoading(false);
    }, []);

    // 2. Fetch Posts (Usando a nova função otimizada)
    useEffect(() => {
        if (location) fetchPosts();
    }, [location]);

    const fetchPosts = async () => {
        try {
            const { data, error } = await supabase.rpc('get_posts_in_radius', {
                user_lat: location!.lat,
                user_long: location!.lng,
                radius_km: 25
            });
            if (error) throw error;
            setPosts(data || []);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    // ... (Funções handleTextChange, searchMarkets, selectMarketMention, handleImageSelect, handleCreatePost mantidas iguais) ...
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewContent(value);
        const lastWord = value.split(/\s+/).pop();
        if (lastWord && lastWord.startsWith('@') && lastWord.length > 1) {
            setMentionQuery(lastWord.substring(1));
            searchMarkets(lastWord.substring(1));
        } else {
            setMentionQuery(null);
            setMarketSuggestions([]);
        }
    };

    const searchMarkets = async (query: string) => {
        const { data } = await supabase.from('markets').select('id, name, address').ilike('name', `%${query}%`).limit(5);
        setMarketSuggestions(data || []);
    };

    const selectMarketMention = (market: MarketSimple) => {
        const words = newContent.split(/\s+/);
        words.pop();
        setNewContent(`${words.join(" ")} @${market.name} `);
        setLinkedMarket(market);
        setMentionQuery(null);
        setMarketSuggestions([]);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) return toast({ title: "Erro", description: "Máximo 5MB", variant: "destructive" });
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleCreatePost = async () => {
        if (!newContent.trim() && !selectedImage) return;
        setIsPosting(true);
        try {
            let finalImageUrl = null;
            if (selectedImage) {
                const fileExt = selectedImage.name.split('.').pop();
                const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, selectedImage);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('post-images').getPublicUrl(fileName);
                finalImageUrl = data.publicUrl;
            }
            const { error } = await supabase.from('posts').insert({
                user_id: user!.id, content: newContent, market_id: linkedMarket?.id, image_url: finalImageUrl,
                latitude: location!.lat, longitude: location!.lng
            });
            if (error) throw error;
            toast({ title: "Sucesso!", description: "Post publicado." });
            setNewContent(""); setSelectedImage(null); setImagePreview(null); setLinkedMarket(null); setIsCreateOpen(false); fetchPosts();
        } catch (error) { toast({ title: "Erro", variant: "destructive" }); }
        finally { setIsPosting(false); }
    };

    const handleLike = async (post: Post) => {
        const isLiked = post.liked_by_me;
        setPosts(currentPosts => currentPosts.map(p => p.id === post.id ? { ...p, liked_by_me: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
        try {
            if (isLiked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user!.id);
            else await supabase.from('post_likes').insert({ post_id: post.id, user_id: user!.id });
        } catch (err) { fetchPosts(); }
    };

    const openComments = async (post: Post) => {
        setActivePostForComments(post);
        setLoadingComments(true);
        try {
            const { data, error } = await supabase.from('post_comments')
                .select(`id, content, created_at, user_id, profiles (display_name, avatar_url)`)
                .eq('post_id', post.id).order('created_at', { ascending: true });
            if (error) throw error;
            // @ts-ignore
            setComments(data || []);
        } catch (error) { toast({ title: "Erro", description: "Falha ao carregar comentários." }); }
        finally { setLoadingComments(false); }
    };

    const sendComment = async () => {
        if (!newCommentText.trim() || !activePostForComments) return;
        const fakeId = Math.random().toString();
        const tempComment = { id: fakeId, content: newCommentText, created_at: new Date().toISOString(), user_id: user!.id, profiles: { display_name: "Você", avatar_url: null } };
        setComments([...comments, tempComment]);
        setNewCommentText("");
        const { error } = await supabase.from('post_comments').insert({ post_id: activePostForComments.id, user_id: user!.id, content: tempComment.content });
        if (error) setComments(comments.filter(c => c.id !== fakeId));
        else setPosts(posts.map(p => p.id === activePostForComments.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    };

    return (
        <div className="min-h-screen bg-background/50 pb-24">
            {/* Header com Botão Voltar */}
            <div className="bg-background/80 backdrop-blur-md px-4 py-4 sticky top-0 z-20 border-b border-border/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-display font-bold bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">Comunidade</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Raio de 25km</p>
                    </div>
                </div>
                <AppMenu triggerClassName="text-foreground/80 hover:bg-secondary/50 p-2 rounded-full" />
            </div>

            {/* Feed Otimizado */}
            <main className="px-4 pt-4 space-y-6 max-w-lg mx-auto">
                {loading ? (
                    <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <p className="text-muted-foreground">Seja o primeiro a postar na sua região!</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <article key={post.id} className="bg-card/50 backdrop-blur-sm border-none shadow-md shadow-indigo-100/50 rounded-[2rem] p-5 animate-fade-in">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-11 h-11 border-2 border-white shadow-sm">
                                        <AvatarImage src={getSecureUrl(post.author_avatar)} className="object-cover" />
                                        <AvatarFallback>{post.author_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-[15px]">{post.author_name}</p>
                                        <div className="flex items-center text-xs text-muted-foreground gap-2 mt-0.5">
                                            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
                                            {post.market_name && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (post.market_id) navigate(`/ver-mercado/${post.market_id}`); }}
                                                    className="flex items-center text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-0.5 rounded-md transition-colors"
                                                >
                                                    <Store className="w-3 h-3 mr-1" /> @{post.market_name}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[15px] text-foreground/90 mb-4 whitespace-pre-wrap">{post.content}</p>
                            {post.image_url && (
                                <div className="mb-4 rounded-2xl overflow-hidden shadow-sm aspect-[4/3] bg-secondary/20">
                                    <img src={post.image_url} alt="Oferta" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                            )}
                            <div className="flex items-center gap-6 pt-3 border-t border-border/40">
                                <button onClick={() => handleLike(post)} className={cn("flex items-center gap-2 text-sm transition-all group", post.liked_by_me ? "text-rose-500 font-medium" : "text-muted-foreground")}>
                                    <Heart className={cn("w-6 h-6 transition-transform group-active:scale-125", post.liked_by_me ? "fill-current" : "stroke-[1.5px]")} />
                                    <span>{post.likes_count > 0 && post.likes_count}</span>
                                </button>
                                <button onClick={() => openComments(post)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <MessageCircle className="w-6 h-6 stroke-[1.5px]" />
                                    <span>{post.comments_count > 0 && post.comments_count}</span>
                                </button>
                            </div>
                        </article>
                    ))
                )}
            </main>

            {/* FAB */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button className="fixed bottom-24 right-5 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-tr from-indigo-500 to-pink-500 hover:scale-105 transition-transform text-white z-40">
                        <Plus className="w-8 h-8" strokeWidth={2.5} />
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[95%] max-w-md rounded-[2rem] top-[10%] translate-y-0 p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-white/20">
                    <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>Nova Publicação</DialogTitle></DialogHeader>
                    <div className="space-y-4 p-6 pt-2">
                        <div className="relative">
                            <Textarea
                                placeholder="Use @ para marcar um mercado..."
                                value={newContent}
                                onChange={handleTextChange}
                                className="min-h-[120px] text-base bg-transparent border-none focus-visible:ring-0 resize-none p-0"
                            />
                            {mentionQuery !== null && marketSuggestions.length > 0 && (
                                <div className="absolute bottom-0 left-0 w-full bg-popover border rounded-xl shadow-lg z-50 overflow-hidden">
                                    {marketSuggestions.map(m => (
                                        <div key={m.id} onClick={() => selectMarketMention(m)} className="p-3 hover:bg-muted cursor-pointer text-sm border-b last:border-none">
                                            <p className="font-bold text-indigo-600">@{m.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{m.address}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {imagePreview && (
                            <div className="relative rounded-xl overflow-hidden h-40 bg-secondary/30">
                                <img src={imagePreview} className="w-full h-full object-cover" />
                                <button onClick={() => { setImagePreview(null); setSelectedImage(null); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                            </div>
                        )}
                        <div className="border-t pt-4 flex justify-between items-center">
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-6 h-6 text-indigo-500" /></Button>
                            <Button onClick={handleCreatePost} disabled={isPosting || (!newContent && !selectedImage)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
                                {isPosting ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sheet Comentários */}
            <Sheet open={!!activePostForComments} onOpenChange={(open) => !open && setActivePostForComments(null)}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[2rem] p-0 flex flex-col">
                    <SheetHeader className="p-6 border-b"><SheetTitle>Comentários</SheetTitle></SheetHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {loadingComments ? <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : comments.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                                <Avatar className="w-8 h-8 mt-1">
                                    <AvatarImage src={getSecureUrl(comment.profiles?.avatar_url || undefined)} />
                                    <AvatarFallback>{comment.profiles?.display_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="bg-secondary/30 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
                                    <p className="text-xs font-bold mb-1 opacity-70">{comment.profiles?.display_name}</p>
                                    <p className="text-sm">{comment.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t bg-background flex gap-2">
                        <Input placeholder="Escreva um comentário..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} className="rounded-full bg-secondary/50 border-none" />
                        <Button size="icon" onClick={sendComment} disabled={!newCommentText.trim()} className="rounded-full w-10 h-10 shrink-0"><Send className="w-4 h-4" /></Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}