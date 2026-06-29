/**
 * Step 4: 详细规划页面（重新设计版）
 *
 * 交互模式:
 *  - 顶部 Tab：角色人设 / 情节列表 / 伏笔反转 / 叙事顺序
 *  - 边框式卡片，可编辑
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useShortStoryStore } from "@/stores/shortStoryStore";
import { useAppStore } from "@/stores/appStore";
// StepNavigator removed — sidebar now shows step progress
import type { CharacterProfile, KeyScene, ForeshadowingTwistPair } from "@/types/shortStory";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  User,
  Users,
  BookOpen,
  Sparkles,
  Eye,
  Pencil,
  Check,
  Loader2,
  Plus,
  X,
} from "lucide-react";

export default function DetailPlanPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get("novelId");
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const { setting, detailPlan, isGeneratingPlan, generateDetailPlan, loadProgress } =
    useShortStoryStore();

  const [activeTab, setActiveTab] = useState("characters");
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [showAddScene, setShowAddScene] = useState(false);
  const [newScene, setNewScene] = useState<Partial<KeyScene>>({
    title: "",
    description: "",
    purpose: "推进剧情",
    emotion: "",
    foreshadowing: undefined,
    twist: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [localDetailPlan, setLocalDetailPlan] = useState(detailPlan);

  useEffect(() => {
    if (novelId) loadProgress(novelId);
  }, [novelId, loadProgress]);

  useEffect(() => {
    if (novelId) {
      setIsLoading(true);
      setHasLoaded(false);
      useShortStoryStore.getState().loadSetting(novelId).finally(() => {
        setIsLoading(false);
        setHasLoaded(true);
      });
    }
  }, [novelId]);

  useEffect(() => {
    if (detailPlan) setLocalDetailPlan(detailPlan);
  }, [detailPlan]);

  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && setting && !isGeneratingPlan && setting.selected_plan_id) {
      if (setting.character_profiles) {
        setLocalDetailPlan({
          characters: setting.character_profiles,
          keyScenes: setting.key_scenes || [],
          foreshadowingTwists: setting.foreshadowing_twists || [],
          narrativeOrderDetail: setting.narrative_order_detail || "",
        });
        return;
      }
      if (!detailPlan && !localDetailPlan) generateDetailPlan(novelId);
    }
  }, [novelId, isLoading, hasLoaded, setting, isGeneratingPlan]);

  const handleRegenerate = async () => {
    if (!novelId) return;
    if (editingCharacter || editingScene) {
      if (!window.confirm("重新生成会覆盖当前所有编辑，是否继续？")) return;
    }
    await generateDetailPlan(novelId);
    showToast("详细规划已重新生成", "success");
  };

  const handleConfirm = () => navigate(`/chapters?novelId=${novelId}`);

  const handleSaveCharacter = async (key: string, updated: CharacterProfile) => {
    if (!novelId || !localDetailPlan) return;
    const upd = { ...localDetailPlan };
    const cur = upd.characters || { protagonist: updated };
    if (key === "protagonist") upd.characters = { ...cur, protagonist: updated };
    else if (key === "antagonist") upd.characters = { ...cur, antagonist: updated };
    else if (key.startsWith("supporting-")) {
      const idx = parseInt(key.split("-")[1]);
      const sup = [...(cur.supporting || [])];
      sup[idx] = updated;
      upd.characters = { ...cur, supporting: sup };
    }
    setLocalDetailPlan(upd);
    setEditingCharacter(null);
    try {
      await useShortStoryStore.getState().updateSetting(novelId, {
        character_profiles: upd.characters || undefined,
      });
      showToast("角色已保存", "success");
    } catch {
      showToast("保存失败", "error");
    }
  };

  const handleSaveScene = async (sceneId: number, updated: KeyScene) => {
    if (!novelId || !localDetailPlan) return;
    const scenes = localDetailPlan.keyScenes.map((s) => (s.scene_id === sceneId ? updated : s));
    const upd = { ...localDetailPlan, keyScenes: scenes };
    setLocalDetailPlan(upd);
    setEditingScene(null);
    try {
      await useShortStoryStore.getState().updateSetting(novelId, { key_scenes: scenes });
      showToast("场景已保存", "success");
    } catch {
      showToast("保存失败", "error");
    }
  };

  const handleAddScene = async () => {
    if (!novelId || !localDetailPlan) return;
    if (!newScene.title || !newScene.description) {
      showToast("请填写场景标题和描述", "warning");
      return;
    }
    const maxId = localDetailPlan.keyScenes.reduce((max, s) => Math.max(max, s.scene_id), 0);
    const toAdd: KeyScene = {
      scene_id: maxId + 1,
      title: newScene.title || "",
      description: newScene.description || "",
      purpose: (newScene.purpose as KeyScene["purpose"]) || "推进剧情",
      emotion: newScene.emotion || "",
      foreshadowing: newScene.foreshadowing,
      twist: newScene.twist,
    };
    const scenes = [...localDetailPlan.keyScenes, toAdd];
    setLocalDetailPlan({ ...localDetailPlan, keyScenes: scenes });
    setShowAddScene(false);
    setNewScene({ title: "", description: "", purpose: "推进剧情", emotion: "" });
    try {
      await useShortStoryStore.getState().updateSetting(novelId, { key_scenes: scenes });
      showToast("场景已添加", "success");
    } catch {
      showToast("保存失败", "error");
    }
  };

  if (isGeneratingPlan) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs text-muted-foreground">AI 正在生成详细规划...</span>
        </div>
      </div>
    );
  }

  if (!localDetailPlan) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center py-16">
          <Button onClick={handleRegenerate} size="sm">
            <RefreshCw className="w-3 h-3 mr-1" /> 生成规划
          </Button>
        </div>
      </div>
    );
  }

  const { characters, keyScenes, foreshadowingTwists, narrativeOrderDetail } = localDetailPlan;

  const tabs = [
    { key: "characters", label: "角色人设", icon: Users },
    { key: "scenes", label: `情节列表 (${keyScenes.length})`, icon: BookOpen },
    { key: "foreshadowing", label: `伏笔反转 (${foreshadowingTwists.length})`, icon: Eye },
    { key: "narrative", label: "叙事顺序", icon: Sparkles },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-base font-semibold">Step 4: 详细规划</h1>
          <p className="text-[11px] text-muted-foreground">
            爽点：{setting?.core_hook?.slice(0, 40)}
            {setting?.core_hook && setting.core_hook.length > 40 ? "..." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="text-xs h-7">
            <RefreshCw className="w-3 h-3 mr-1" /> 重新生成
          </Button>
          <Button size="sm" onClick={handleConfirm} className="text-xs h-7">
            确认规划 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex border-b flex-shrink-0 px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center px-3 py-1.5 text-[11px] border-b-2 transition-colors
              ${activeTab === t.key ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="w-3 h-3 mr-1" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {/* characters */}
        {activeTab === "characters" && (
          <div className="max-w-2xl space-y-3 py-3">
            {characters?.protagonist && (
              <CharCard
                title="主角"
                charKey="protagonist"
                data={characters.protagonist}
                editing={editingCharacter === "protagonist"}
                onEdit={() => setEditingCharacter("protagonist")}
                onSave={handleSaveCharacter}
              />
            )}
            {characters?.antagonist && (
              <CharCard
                title="对手"
                charKey="antagonist"
                data={characters.antagonist}
                editing={editingCharacter === "antagonist"}
                onEdit={() => setEditingCharacter("antagonist")}
                onSave={handleSaveCharacter}
              />
            )}
            {characters?.supporting?.map((ch, i) => (
              <CharCard
                key={i}
                title={`辅助角色 ${i + 1}`}
                charKey={`supporting-${i}`}
                data={ch}
                editing={editingCharacter === `supporting-${i}`}
                onEdit={() => setEditingCharacter(`supporting-${i}`)}
                onSave={handleSaveCharacter}
              />
            ))}
          </div>
        )}

        {/* scenes */}
        {activeTab === "scenes" && (
          <div className="max-w-2xl space-y-2 py-3">
            <div className="flex justify-end mb-1">
              <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => setShowAddScene(true)}>
                <Plus className="w-3 h-3 mr-1" /> 添加情节
              </Button>
            </div>
            {keyScenes.map((s) => (
              <SceneCard
                key={s.scene_id}
                scene={s}
                editing={editingScene === s.scene_id}
                onEdit={() => setEditingScene(s.scene_id)}
                onSave={handleSaveScene}
              />
            ))}
            {showAddScene && (
              <div className="border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold">添加新情节</span>
                  <X className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setShowAddScene(false)} />
                </div>
                <Field label="标题" v={newScene.title} onChange={(v) => setNewScene({ ...newScene, title: v })} />
                <Field label="描述" v={newScene.description} onChange={(v) => setNewScene({ ...newScene, description: v })} />
                <Field label="目的" v={newScene.purpose} onChange={(v) => setNewScene({ ...newScene, purpose: v })} />
                <Field label="情绪" v={newScene.emotion} onChange={(v) => setNewScene({ ...newScene, emotion: v })} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => setShowAddScene(false)}>取消</Button>
                  <Button size="sm" className="text-xs h-6" onClick={handleAddScene}>添加</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* foreshadowing */}
        {activeTab === "foreshadowing" && (
          <div className="max-w-2xl space-y-3 py-3">
            {foreshadowingTwists.map((pair) => (
              <div key={pair.pair_id} className="border">
                <div className="px-3 py-1.5 border-b flex items-center gap-1.5">
                  <Eye className="w-3 h-3" />
                  <span className="text-[11px] font-semibold">伏笔 {pair.pair_id} → 反转 {pair.pair_id}</span>
                </div>
                <div className="p-3 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">伏笔</div>
                    <div className="text-[11px] space-y-0.5">
                      <div><span className="text-muted-foreground">位置：</span>{pair.foreshadowing.location}</div>
                      <div><span className="text-muted-foreground">内容：</span>{pair.foreshadowing.content}</div>
                      <div><span className="text-muted-foreground">隐蔽度：</span>{pair.foreshadowing.subtlety}/10</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">反转</div>
                    <div className="text-[11px] space-y-0.5">
                      <div><span className="text-muted-foreground">位置：</span>{pair.twist.location}</div>
                      <div><span className="text-muted-foreground">揭露：</span>{pair.twist.reveal}</div>
                      <div><span className="text-muted-foreground">冲击力：</span>{pair.twist.impact}/10</div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                  回看满足感：{pair.twist.satisfaction}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* narrative */}
        {activeTab === "narrative" && (
          <div className="max-w-2xl py-3">
            <div className="border">
              <div className="px-3 py-1.5 border-b">
                <span className="text-[11px] font-semibold">叙事顺序细化</span>
              </div>
              <div className="p-3">
                <p className="text-xs leading-relaxed">{narrativeOrderDetail}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Sub-components
// =========================================================================

function CharCard({
  title,
  charKey,
  data,
  editing,
  onEdit,
  onSave,
}: {
  title: string;
  charKey: string;
  data: CharacterProfile;
  editing: boolean;
  onEdit: () => void;
  onSave: (key: string, d: CharacterProfile) => void;
}) {
  const [local, setLocal] = useState(data);
  useEffect(() => setLocal(data), [data]);

  return (
    <div className="border">
      <div className="px-3 py-1.5 border-b flex items-center justify-between">
        <span className="text-[11px] font-semibold flex items-center gap-1.5">
          <User className="w-3 h-3" />
          {title}：{local.name}
        </span>
        <button
          className="text-[10px] border px-2 py-0.5 hover:border-foreground flex items-center gap-1"
          onClick={() => (editing ? onSave(charKey, local) : onEdit())}
        >
          {editing ? <><Check className="w-3 h-3" /> 保存</> : <><Pencil className="w-3 h-3" /> 编辑</>}
        </button>
      </div>
      <div className="p-3">
        {editing ? (
          <div className="space-y-1.5">
            {["name","age","surface_identity","real_identity","desire","fear","secret","flaw","arc","relationship_to_protagonist","motivation","why_opposing","identity","purpose_in_story","key_trait","role"].map((k) => (
              <Field key={k} label={k} v={(local as any)[k]} onChange={(v) => setLocal({ ...local, [k]: v })} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {["age","surface_identity","real_identity","desire","fear","secret","flaw","arc","relationship_to_protagonist","motivation","why_opposing","identity","purpose_in_story","key_trait","role"].map((k) => {
              const v = (data as any)[k];
              if (!v) return null;
              return (
                <div key={k} className="flex gap-1">
                  <span className="text-muted-foreground shrink-0">{k}:</span>
                  <span className="font-medium truncate">{v}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  editing,
  onEdit,
  onSave,
}: {
  scene: KeyScene;
  editing: boolean;
  onEdit: () => void;
  onSave: (sceneId: number, d: KeyScene) => void;
}) {
  const [local, setLocal] = useState(scene);
  useEffect(() => setLocal(scene), [scene]);

  const purposeColors: Record<string, string> = {
    "推进剧情": "bg-accent",
    "揭示人物": "bg-accent",
    "制造冲突": "bg-accent",
    "铺垫转折": "bg-accent",
  };

  return (
    <div className="border">
      <div className="px-3 py-1.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] border px-1.5 py-0">场景 {scene.scene_id}</span>
          <span className="text-[11px] font-medium">{local.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0 border ${purposeColors[local.purpose] || ""}`}>{local.purpose}</span>
          <button
            className="text-[10px] border px-2 py-0.5 hover:border-foreground flex items-center gap-1"
            onClick={() => (editing ? onSave(scene.scene_id, local) : onEdit())}
          >
            {editing ? <><Check className="w-3 h-3" /> 保存</> : <><Pencil className="w-3 h-3" /> 编辑</>}
          </button>
        </div>
      </div>
      <div className="p-3">
        {editing ? (
          <div className="space-y-1.5">
            <Field label="标题" v={local.title} onChange={(v) => setLocal({ ...local, title: v })} />
            <Field label="描述" v={local.description} onChange={(v) => setLocal({ ...local, description: v })} />
            <Field label="目的" v={local.purpose} onChange={(v) => setLocal({ ...local, purpose: v })} />
            <Field label="情绪" v={local.emotion} onChange={(v) => setLocal({ ...local, emotion: v })} />
          </div>
        ) : (
          <>
            <p className="text-[11px] leading-relaxed">{local.description}</p>
            <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span>情绪：{local.emotion}</span>
              {local.foreshadowing && <span>伏笔：{local.foreshadowing}</span>}
              {local.twist && <span>反转：{local.twist}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  v,
  onChange,
}: {
  label: string;
  v?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <input
        className="flex-1 bg-background border border-muted text-foreground px-2 py-0.5 text-[11px] outline-none focus:border-foreground"
        value={v || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
