import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    MapPin, Heart, MessageCircle, Send, Loader2, Store, Plus, Image as ImageIcon, X, ArrowLeft, MoreHorizontal, CornerDownRight, Search, Trash2, Flag
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
import { Card } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

    const getSecureUrl = useCallback((url: string | null | undefined) => {
        if (!url) return undefined;
        return `${url}${url.includes('?') ? '&' : '?'}t=${sessionTimestamp}`;
    }, [sessionTimestamp]);

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
    const [isSearchingMarkets, setIsSearchingMarkets] = useState(false);

    // Comentários
    const [activePostForComments, setActivePostForComments] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newCommentText, setNewCommentText] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);

    useEffect(() => {
        const cachedLoc = sessionStorage.getItem('user_location');
        if (cachedLoc) {
            setLocation(JSON.parse(cachedLoc));
        }

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setLocation(newLoc);
                    sessionStorage.setItem('user_location', JSON.stringify(newLoc));
                },
                () => {
                    if (!cachedLoc) {
                        toast({ title: "Localização necessária", description: "Ative o GPS para ver ofertas.", variant: "destructive", duration: 2000 });
                        setLoading(false);
                    }
                },
                { timeout: 10000, maximumAge: 60000 }
            );
        } else setLoading(false);
    }, []);

    const fetchPosts = useCallback(async () => {
        if (!location) return;
        try {
            const { data, error } = await supabase.rpc('get_posts_in_radius', {
                user_lat: location.lat,
                user_long: location.lng,
                radius_km: 25
            });
            if (error) throw error;
            setPosts(data || []);
        } catch (error) {
            console.error("Erro ao carregar posts:", error);
        } finally {
            setLoading(false);
        }
    }, [location]);

    useEffect(() => {
        if (location) fetchPosts();
    }, [fetchPosts]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewContent(value);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const words = textBeforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1];

        if (currentWord && currentWord.startsWith('@') && currentWord.length > 1) {
            const query = currentWord.substring(1);
            setMentionQuery(query);
            searchMarkets(query);
        } else {
            setMentionQuery(null);
            setMarketSuggestions([]);
        }
    };

    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    const searchMarkets = (query: string) => {
        setIsSearchingMarkets(true);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        searchTimerRef.current = setTimeout(async () => {
            const { data } = await supabase.from('markets')
                .select('id, name, address')
                .ilike('name', `%${query}%`)
                .limit(50);

            setMarketSuggestions(data || []);
            setIsSearchingMarkets(false);
        }, 300);
    };

    const selectMarketMention = (market: MarketSimple) => {
        const cursorPosition = (document.getElementById('post-textarea') as HTMLTextAreaElement)?.selectionStart || newContent.length;
        const textBeforeCursor = newContent.substring(0, cursorPosition);
        const textAfterCursor = newContent.substring(cursorPosition);

        const words = textBeforeCursor.split(/\s+/);
        words.pop();

        const newText = `${words.join(" ")} ${market.name} ${textAfterCursor}`;

        setNewContent(newText);
        setLinkedMarket(market);
        setMentionQuery(null);
        setMarketSuggestions([]);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) return toast({ title: "Arquivo muito grande", description: "Máximo de 5MB.", variant: "destructive", duration: 2000 });
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
                if (!uploadError) {
                    const { data } = supabase.storage.from('post-images').getPublicUrl(fileName);
                    finalImageUrl = data.publicUrl;
                }
            }
            const { error } = await supabase.from('posts').insert({
                user_id: user!.id, content: newContent, market_id: linkedMarket?.id, image_url: finalImageUrl,
                latitude: location!.lat, longitude: location!.lng
            });
            if (error) throw error;
            toast({ title: "Publicado!", description: "Sua oferta foi compartilhada.", duration: 2000 });
            setNewContent(""); setSelectedImage(null); setImagePreview(null); setLinkedMarket(null); setIsCreateOpen(false); fetchPosts();
        } catch (error) { toast({ title: "Erro", variant: "destructive", duration: 2000 }); }
        finally { setIsPosting(false); }
    };

    const handleDeletePost = async (postId: string) => {
        const previousPosts = [...posts];
        setPosts(posts.filter(p => p.id !== postId));

        try {
            const { data, error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postId)
                .eq('user_id', user!.id)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("Permissão negada ou post já apagado.");
            }

            toast({ title: "Post apagado", description: "Removido com sucesso.", duration: 2000 });

        } catch (error: any) {
            console.error("Erro ao deletar:", error);
            setPosts(previousPosts);
            toast({
                title: "Erro ao apagar",
                description: "Não foi possível remover o post.",
                variant: "destructive",
                duration: 2000
            });
        }
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
        } catch (error) { toast({ title: "Erro", description: "Falha ao carregar comentários.", duration: 2000 }); }
        finally { setLoadingComments(false); }
    };

    const sendComment = async () => {
        if (!newCommentText.trim() || !activePostForComments) return;
        const fakeId = Math.random().toString();
        const tempComment = { id: fakeId, content: newCommentText, created_at: new Date().toISOString(), user_id: user!.id, profiles: { display_name: "Você", avatar_url: null } };

        setComments([...comments, tempComment]);
        setNewCommentText("");

        const { error } = await supabase.from('post_comments').insert({ post_id: activePostForComments.id, user_id: user!.id, content: tempComment.content });
        if (error) {
            setComments(comments.filter(c => c.id !== fakeId));
            toast({ title: "Erro ao comentar", variant: "destructive", duration: 2000 });
        } else {
            setPosts(posts.map(p => p.id === activePostForComments.id ? { ...p, comments_count: p.comments_count + 1 } : p));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 font-sans">
            {/* Header Sticky */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-gray-100 -ml-2 text-gray-500">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Comunidade</h1>
                            {location && (
                                <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3 fill-indigo-600" /> Explorando ofertas
                                </p>
                            )}
                        </div>
                    </div>
                    <AppMenu triggerClassName="rounded-full hover:bg-gray-100 p-2 text-gray-500" />
                </div>
            </header>

            <main className="pt-20 px-4 space-y-5 max-w-lg mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center pt-32 gap-3 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-sm">Buscando ofertas...</span>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageCircle className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-gray-900 font-bold mb-1">Tudo quieto por aqui</h3>
                        <p className="text-gray-500 text-sm">Seja o primeiro a compartilhar uma oferta ou dica!</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <Card key={post.id} className="border-none shadow-sm shadow-indigo-100 rounded-3xl overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
                            <div className="p-5 pb-3">
                                {/* Post Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-10 h-10 border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity">
                                            <AvatarImage src={getSecureUrl(post.author_avatar)} className="object-cover" />
                                            <AvatarFallback className="bg-gray-100 text-gray-500 font-bold text-xs">
                                                {post.author_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-gray-900 leading-none">{post.author_name}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">• {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
                                            </div>

                                            {post.market_name && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); if (post.market_id) navigate(`/ver-mercado/${post.market_id}`); }}
                                                    className="flex items-center gap-1 mt-1 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline w-fit"
                                                >
                                                    <Store className="w-3 h-3" />
                                                    {post.market_name}
                                                    <CornerDownRight className="w-3 h-3 text-gray-300 ml-0.5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 -mr-2 rounded-full hover:bg-gray-100 transition-colors focus-visible:ring-0">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 rounded-xl border-gray-100 shadow-xl">
                                            {post.user_id === user?.id ? (
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer gap-2 font-medium"
                                                    onClick={() => handleDeletePost(post.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Apagar
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    className="text-gray-600 focus:bg-gray-50 cursor-pointer gap-2"
                                                    onClick={() => toast({ title: "Reportado", description: "Obrigado por colaborar.", duration: 2000 })}
                                                >
                                                    <Flag className="w-4 h-4" />
                                                    Reportar
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <p className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap mb-2">
                                    {post.content}
                                </p>
                            </div>

                            {post.image_url && (
                                <div className="w-full bg-gray-50">
                                    <img
                                        src={post.image_url}
                                        alt="Oferta"
                                        className="w-full h-auto object-cover max-h-[500px]"
                                        loading="lazy"
                                    />
                                </div>
                            )}

                            <div className="px-5 py-3 flex items-center gap-6">
                                <button onClick={() => handleLike(post)} className="flex items-center gap-2 group focus:outline-none">
                                    <div className={cn("p-2 rounded-full transition-colors", post.liked_by_me ? "bg-rose-50" : "group-hover:bg-gray-100")}>
                                        <Heart className={cn("w-6 h-6 transition-all duration-300", post.liked_by_me ? "fill-rose-500 text-rose-500 scale-110" : "text-gray-500 group-hover:text-gray-700")} />
                                    </div>
                                    {post.likes_count > 0 && <span className={cn("text-sm font-semibold", post.liked_by_me ? "text-rose-600" : "text-gray-500")}>{post.likes_count}</span>}
                                </button>

                                <button onClick={() => openComments(post)} className="flex items-center gap-2 group focus:outline-none">
                                    <div className="p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                                        <MessageCircle className="w-6 h-6 text-gray-500 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                    {post.comments_count > 0 && <span className="text-sm font-semibold text-gray-500 group-hover:text-indigo-600">{post.comments_count}</span>}
                                </button>
                            </div>
                        </Card>
                    ))
                )}
            </main>

            {/* CREATE POST - FULL SCREEN ON MOBILE */}
            <div className="fixed bottom-24 right-6 z-30">
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-14 w-14 rounded-2xl shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center">
                            <Plus className="w-7 h-7" />
                        </Button>
                    </DialogTrigger>

                    {/* Alteração crítica: h-full no mobile para evitar problemas com teclado */}
                    <DialogContent className="w-full h-full max-w-none rounded-none sm:h-auto sm:max-w-lg sm:rounded-3xl p-0 gap-0 overflow-hidden bg-white border-none flex flex-col">
                        <DialogHeader className="px-5 py-4 border-b border-gray-100 flex flex-row items-center justify-between space-y-0 bg-white z-20 shrink-0 safe-top">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setIsCreateOpen(false)} className="sm:hidden -ml-2">
                                    <X className="w-6 h-6" />
                                </Button>
                                <DialogTitle className="text-lg font-bold text-gray-900">Novo Post</DialogTitle>
                            </div>
                            <Button
                                onClick={handleCreatePost}
                                disabled={isPosting || (!newContent && !selectedImage)}
                                className="rounded-full px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 h-9"
                            >
                                {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publicar"}
                            </Button>
                        </DialogHeader>

                        <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
                            <div className="flex gap-3">
                                <Avatar className="w-10 h-10 border border-gray-100 shrink-0">
                                    <AvatarImage src={getSecureUrl(user?.user_metadata?.avatar_url)} />
                                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">EU</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 relative">
                                    {/* text-base para evitar zoom no iPhone */}
                                    <Textarea
                                        id="post-textarea"
                                        placeholder="O que você encontrou de bom? Use @ para marcar um mercado."
                                        value={newContent}
                                        onChange={handleTextChange}
                                        className="w-full min-h-[120px] text-base leading-relaxed border-none focus-visible:ring-0 p-2 placeholder:text-gray-400 resize-none font-medium bg-transparent"
                                    />

                                    {/* LISTA DE SUGESTÕES (Estática para não sobrepor) */}
                                    {mentionQuery !== null && (
                                        <div className="mt-2 w-full bg-white rounded-xl border border-indigo-100 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="bg-indigo-50/50 px-3 py-2 flex items-center justify-between border-b border-indigo-50">
                                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                                    <Search className="w-3 h-3" />
                                                    {isSearchingMarkets ? "Buscando..." : "Selecione o Mercado"}
                                                </span>
                                            </div>
                                            <div className="max-h-[220px] overflow-y-auto">
                                                {marketSuggestions.map(m => (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => selectMarketMention(m)}
                                                        className="p-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between group transition-colors border-b last:border-0 border-gray-50"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm text-gray-800 group-hover:text-indigo-700">{m.name}</span>
                                                            <span className="text-xs text-gray-400 truncate max-w-[200px]">{m.address}</span>
                                                        </div>
                                                        <Plus className="w-4 h-4 text-gray-300 group-hover:text-indigo-500" />
                                                    </div>
                                                ))}
                                                {!isSearchingMarkets && marketSuggestions.length === 0 && (
                                                    <div className="p-4 text-center text-xs text-gray-400">Nenhum mercado encontrado.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {linkedMarket && (
                                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
                                            <Store className="w-3.5 h-3.5" />
                                            {linkedMarket.name}
                                            <button onClick={() => setLinkedMarket(null)} className="hover:bg-indigo-100 rounded-full p-0.5 ml-1">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {imagePreview && (
                                <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 group mt-2 shrink-0">
                                    <img src={imagePreview} className="w-full max-h-[300px] object-cover" />
                                    <button
                                        onClick={() => { setImagePreview(null); setSelectedImage(null); }}
                                        className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 backdrop-blur-sm transition-colors z-10"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer Sticky no Mobile */}
                        <div className="p-4 border-t border-gray-50 flex items-center justify-between bg-gray-50/50 shrink-0 pb-safe">
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </Button>
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{newContent.length}/280</span>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Comments Sheet - Responsive Height */}
            <Sheet open={!!activePostForComments} onOpenChange={(open) => !open && setActivePostForComments(null)}>
                <SheetContent side="bottom" className="h-[90dvh] sm:h-[85vh] rounded-t-[2.5rem] p-0 flex flex-col bg-gray-50/90 backdrop-blur-xl border-gray-200">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-4 mb-2 shrink-0" />
                    <SheetHeader className="px-6 pb-4 border-b border-gray-200/50">
                        <SheetTitle className="text-center text-gray-800">Comentários</SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                        {loadingComments ? (
                            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                        ) : comments.length === 0 ? (
                            <div className="text-center text-gray-400 py-10 text-sm">Nenhum comentário ainda.</div>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <Avatar className="w-8 h-8 mt-1 border border-white shadow-sm shrink-0">
                                        <AvatarImage src={getSecureUrl(comment.profiles?.avatar_url || undefined)} />
                                        <AvatarFallback className="text-[10px]">{comment.profiles?.display_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col gap-1 max-w-[85%]">
                                        <span className="text-xs font-bold text-gray-600 ml-1">{comment.profiles?.display_name}</span>
                                        <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-800 leading-relaxed">
                                            {comment.content}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-gray-100 pb-safe sm:pb-4 shrink-0">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1.5 pr-2 focus-within:ring-2 focus-within:ring-indigo-100 transition-all border border-transparent focus-within:border-indigo-200">
                            <Avatar className="w-8 h-8 shrink-0">
                                <AvatarImage src={getSecureUrl(user?.user_metadata?.avatar_url)} />
                                <AvatarFallback className="text-[10px]">EU</AvatarFallback>
                            </Avatar>
                            {/* text-base para evitar zoom no input de comentário */}
                            <Input
                                placeholder="Adicione um comentário..."
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base h-9"
                                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                            />
                            <Button
                                size="icon"
                                onClick={sendComment}
                                disabled={!newCommentText.trim()}
                                className={cn(
                                    "rounded-full w-8 h-8 shrink-0 transition-all",
                                    newCommentText.trim() ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-200 text-gray-400"
                                )}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}