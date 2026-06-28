import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
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
} from 'lucide-react';
import type { CharacterProfile, KeyScene, ForeshadowingTwistPair } from '@/types/shortStory';

/**
 * Step 3: 详细规划展示页面
 */
export default function DetailPlanPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    setting,
    detailPlan,
    isGeneratingPlan,
    generateDetailPlan,
    loadProgress,
  } = useShortStoryStore();

  const [activeTab, setActiveTab] = useState('characters');
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [showAddScene, setShowAddScene] = useState(false);
  const [newScene, setNewScene] = useState<Partial<KeyScene>>({
    title: '',
    description: '',
    purpose: '推进剧情',
    emotion: '',
    foreshadowing: undefined,
    twist: undefined,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [localDetailPlan, setLocalDetailPlan] = useState(detailPlan);

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  // 加载设定
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

  // 同步 detailPlan 到本地状态
  useEffect(() => {
    if (detailPlan) {
      setLocalDetailPlan(detailPlan);
    }
  }, [detailPlan]);

  // 如果没有详细规划，自动生成（但先等待数据加载完成）
  useEffect(() => {
    if (novelId && !isLoading && hasLoaded && setting && !isGeneratingPlan && setting.selected_plan_id) {
      // 如果 setting 中已经有详细规划，同步到本地状态，不要重新生成
      if (setting.character_profiles) {
        setLocalDetailPlan({
          characters: setting.character_profiles,
          keyScenes: setting.key_scenes || [],
          foreshadowingTwists: setting.foreshadowing_twists || [],
          narrativeOrderDetail: setting.narrative_order_detail || '',
        });
        return;
      }
      // 只有当本地状态和 store 中都没有详细规划时才触发生成
      if (!detailPlan && !localDetailPlan) {
        generateDetailPlan(novelId);
      }
    }
  }, [novelId, isLoading, hasLoaded, setting, isGeneratingPlan]);

  const handleRegenerate = async () => {
    if (!novelId) return;
    // 警告用户会丢失未保存的编辑
    if (editingCharacter || editingScene) {
      const confirmed = window.confirm('重新生成会覆盖当前所有编辑，是否继续？');
      if (!confirmed) return;
    }
    await generateDetailPlan(novelId);
    showToast('详细规划已重新生成', 'success');
  };

  const handleConfirm = () => {
    navigate(`/chapters?novelId=${novelId}`);
  };

  const handleBack = () => {
    navigate(`/plans?novelId=${novelId}`);
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  // 保存编辑后的角色/场景到后端
  const handleSaveCharacter = async (characterKey: string, updatedData: CharacterProfile) => {
    if (!novelId || !localDetailPlan) return;

    const updatedPlan = { ...localDetailPlan };
    const currentChars = updatedPlan.characters || { protagonist: updatedData };
    if (characterKey === 'protagonist') {
      updatedPlan.characters = { ...currentChars, protagonist: updatedData };
    } else if (characterKey === 'antagonist') {
      updatedPlan.characters = { ...currentChars, antagonist: updatedData };
    } else if (characterKey.startsWith('supporting-')) {
      const index = parseInt(characterKey.split('-')[1]);
      const supporting = [...(currentChars.supporting || [])];
      supporting[index] = updatedData;
      updatedPlan.characters = { ...currentChars, supporting };
    }

    setLocalDetailPlan(updatedPlan);
    setEditingCharacter(null);

    try {
      const charsToSave = updatedPlan.characters || undefined;
      await useShortStoryStore.getState().updateSetting(novelId, {
        character_profiles: charsToSave,
      });
      showToast('角色已保存', 'success');
    } catch (err) {
      showToast('保存失败', 'error');
    }
  };

  const handleSaveScene = async (sceneId: number, updatedData: KeyScene) => {
    if (!novelId || !localDetailPlan) return;

    const updatedScenes = localDetailPlan.keyScenes.map((s) =>
      s.scene_id === sceneId ? updatedData : s
    );
    const updatedPlan = { ...localDetailPlan, keyScenes: updatedScenes };

    setLocalDetailPlan(updatedPlan);
    setEditingScene(null);

    try {
      await useShortStoryStore.getState().updateSetting(novelId, {
        key_scenes: updatedScenes,
      });
      showToast('场景已保存', 'success');
    } catch (err) {
      showToast('保存失败', 'error');
    }
  };

  const handleAddScene = async () => {
    if (!novelId || !localDetailPlan) return;
    if (!newScene.title || !newScene.description) {
      showToast('请填写场景标题和描述', 'warning');
      return;
    }

    const maxId = localDetailPlan.keyScenes.reduce((max, s) => Math.max(max, s.scene_id), 0);
    const sceneToAdd: KeyScene = {
      scene_id: maxId + 1,
      title: newScene.title || '',
      description: newScene.description || '',
      purpose: (newScene.purpose as any) || '推进剧情',
      emotion: newScene.emotion || '',
      foreshadowing: newScene.foreshadowing || undefined,
      twist: newScene.twist || undefined,
    };

    const updatedScenes = [...localDetailPlan.keyScenes, sceneToAdd];
    const updatedPlan = { ...localDetailPlan, keyScenes: updatedScenes };

    setLocalDetailPlan(updatedPlan);
    setShowAddScene(false);
    setNewScene({ title: '', description: '', purpose: '推进剧情', emotion: '', foreshadowing: undefined, twist: undefined });

    try {
      await useShortStoryStore.getState().updateSetting(novelId, {
        key_scenes: updatedScenes,
      });
      showToast('场景已添加', 'success');
    } catch (err) {
      showToast('保存失败', 'error');
    }
  };

  // 生成中状态
  if (isGeneratingPlan) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <StepNavigator currentStep={4} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-muted-foreground">AI 正在生成详细规划...（预计需要 10-30 秒）</p>
        </div>
      </div>
    );
  }

  // 无数据状态
  if (!localDetailPlan) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <StepNavigator currentStep={4} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
          <p className="text-sm text-muted-foreground">暂无详细规划</p>
          <Button onClick={handleRegenerate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            生成规划
          </Button>
        </div>
      </div>
    );
  }

  const { characters, keyScenes, foreshadowingTwists, narrativeOrderDetail } = localDetailPlan;

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={4}
          onStepClick={handleStepClick}
        />
      </div>

      {/* 顶部导航 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            上一步
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-lg font-semibold">Step 3: 详细规划</h1>
            <p className="text-xs text-muted-foreground">
              核心爽点：{setting?.core_hook?.slice(0, 30)}...
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新生成
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            确认规划
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList>
              <TabsTrigger value="characters">
                <Users className="w-4 h-4 mr-2" />
                角色人设
              </TabsTrigger>
              <TabsTrigger value="scenes">
                <BookOpen className="w-4 h-4 mr-2" />
                情节列表 ({keyScenes.length})
              </TabsTrigger>
              <TabsTrigger value="foreshadowing">
                <Eye className="w-4 h-4 mr-2" />
                伏笔与反转 ({foreshadowingTwists.length})
              </TabsTrigger>
              <TabsTrigger value="narrative">
                <Sparkles className="w-4 h-4 mr-2" />
                叙事顺序
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-4">
            {/* 角色人设 */}
            <TabsContent value="characters" className="mt-0 space-y-4">
              {characters?.protagonist && (
                <CharacterCard
                  title="主角"
                  characterKey="protagonist"
                  character={characters.protagonist}
                  isEditing={editingCharacter === 'protagonist'}
                  onEdit={() => setEditingCharacter('protagonist')}
                  onSave={handleSaveCharacter}
                />
              )}
              {characters?.antagonist && (
                <CharacterCard
                  title="对手"
                  characterKey="antagonist"
                  character={characters.antagonist}
                  isEditing={editingCharacter === 'antagonist'}
                  onEdit={() => setEditingCharacter('antagonist')}
                  onSave={handleSaveCharacter}
                />
              )}
              {characters?.supporting?.map((char, index) => (
                <CharacterCard
                  key={index}
                  title={`辅助角色 ${index + 1}`}
                  characterKey={`supporting-${index}`}
                  character={char}
                  isEditing={editingCharacter === `supporting-${index}`}
                  onEdit={() => setEditingCharacter(`supporting-${index}`)}
                  onSave={handleSaveCharacter}
                />
              ))}
            </TabsContent>

            {/* 情节列表 */}
            <TabsContent value="scenes" className="mt-0 space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddScene(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加情节
                </Button>
              </div>
              {keyScenes.map((scene) => (
                <SceneCard
                  key={scene.scene_id}
                  scene={scene}
                  isEditing={editingScene === scene.scene_id}
                  onEdit={() => setEditingScene(scene.scene_id)}
                  onSave={handleSaveScene}
                />
              ))}

              {/* 添加新情节对话框 */}
              {showAddScene && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">添加新情节</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <EditableField label="标题" value={newScene.title} onChange={(v) => setNewScene({ ...newScene, title: v })} />
                    <EditableField label="描述" value={newScene.description} onChange={(v) => setNewScene({ ...newScene, description: v })} />
                    <EditableField label="目的" value={newScene.purpose} onChange={(v) => setNewScene({ ...newScene, purpose: v })} />
                    <EditableField label="情绪" value={newScene.emotion} onChange={(v) => setNewScene({ ...newScene, emotion: v })} />
                    <EditableField label="伏笔（可选）" value={newScene.foreshadowing} onChange={(v) => setNewScene({ ...newScene, foreshadowing: v })} />
                    <EditableField label="反转（可选）" value={newScene.twist} onChange={(v) => setNewScene({ ...newScene, twist: v })} />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAddScene(false)}>取消</Button>
                      <Button size="sm" onClick={handleAddScene}>添加</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 伏笔与反转 */}
            <TabsContent value="foreshadowing" className="mt-0 space-y-4">
              {foreshadowingTwists.map((pair) => (
                <ForeshadowingCard key={pair.pair_id} pair={pair} />
              ))}
            </TabsContent>

            {/* 叙事顺序 */}
            <TabsContent value="narrative" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">叙事顺序细化</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{narrativeOrderDetail}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

// ========== 子组件 ==========

function CharacterCard({
  title,
  characterKey,
  character,
  isEditing,
  onEdit,
  onSave,
}: {
  title: string;
  characterKey: string;
  character: CharacterProfile;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (key: string, data: CharacterProfile) => void;
}) {
  const [data, setData] = useState(character);

  // 当外部 character 变化时同步
  useEffect(() => {
    setData(character);
  }, [character]);

  const handleSave = () => {
    onSave(characterKey, data);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center">
            <User className="w-4 h-4 mr-2" />
            {title}：{data.name}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={isEditing ? handleSave : onEdit}>
            {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isEditing ? (
          <div className="space-y-2">
            <EditableField label="姓名" value={data.name} onChange={(v) => setData({ ...data, name: v })} />
            <EditableField label="年龄" value={data.age} onChange={(v) => setData({ ...data, age: v })} />
            <EditableField label="表面身份" value={data.surface_identity} onChange={(v) => setData({ ...data, surface_identity: v })} />
            <EditableField label="真实身份" value={data.real_identity} onChange={(v) => setData({ ...data, real_identity: v })} />
            <EditableField label="欲望" value={data.desire} onChange={(v) => setData({ ...data, desire: v })} />
            <EditableField label="恐惧" value={data.fear} onChange={(v) => setData({ ...data, fear: v })} />
            <EditableField label="秘密" value={data.secret} onChange={(v) => setData({ ...data, secret: v })} />
            <EditableField label="缺陷" value={data.flaw} onChange={(v) => setData({ ...data, flaw: v })} />
            <EditableField label="弧线" value={data.arc} onChange={(v) => setData({ ...data, arc: v })} />
            {/* Sprint 17: 对手/辅助角色新增字段 */}
            <EditableField label="与主角关系" value={data.relationship_to_protagonist} onChange={(v) => setData({ ...data, relationship_to_protagonist: v })} />
            <EditableField label="动机" value={data.motivation} onChange={(v) => setData({ ...data, motivation: v })} />
            <EditableField label="为什么阻碍" value={data.why_opposing} onChange={(v) => setData({ ...data, why_opposing: v })} />
            <EditableField label="身份" value={data.identity} onChange={(v) => setData({ ...data, identity: v })} />
            <EditableField label="在故事中的作用" value={data.purpose_in_story} onChange={(v) => setData({ ...data, purpose_in_story: v })} />
            <EditableField label="关键特征" value={data.key_trait} onChange={(v) => setData({ ...data, key_trait: v })} />
            <EditableField label="角色定位" value={data.role} onChange={(v) => setData({ ...data, role: v })} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoItem label="年龄" value={data.age} />
            <InfoItem label="表面身份" value={data.surface_identity} />
            <InfoItem label="真实身份" value={data.real_identity} />
            <InfoItem label="欲望" value={data.desire} />
            <InfoItem label="恐惧" value={data.fear} />
            <InfoItem label="秘密" value={data.secret} />
            <InfoItem label="缺陷" value={data.flaw} />
            <InfoItem label="弧线" value={data.arc} />
            <InfoItem label="与主角关系" value={data.relationship_to_protagonist} />
            <InfoItem label="动机" value={data.motivation} />
            <InfoItem label="为什么阻碍" value={data.why_opposing} />
            <InfoItem label="身份" value={data.identity} />
            <InfoItem label="在故事中的作用" value={data.purpose_in_story} />
            <InfoItem label="关键特征" value={data.key_trait} />
            <InfoItem label="角色定位" value={data.role} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SceneCard({
  scene,
  isEditing,
  onEdit,
  onSave,
}: {
  scene: KeyScene;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (sceneId: number, data: KeyScene) => void;
}) {
  const [data, setData] = useState(scene);

  // 当外部 scene 变化时同步
  useEffect(() => {
    setData(scene);
  }, [scene]);

  const handleSave = () => {
    onSave(scene.scene_id, data);
  };

  const purposeColors: Record<string, string> = {
    '推进剧情': 'bg-accent text-foreground',
    '揭示人物': 'bg-accent/80 text-foreground',
    '制造冲突': 'bg-foreground/10 text-foreground',
    '铺垫转折': 'bg-muted text-foreground',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">场景{scene.scene_id}</Badge>
            <CardTitle className="text-sm">{data.title}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={purposeColors[data.purpose] || 'bg-muted'}>{data.purpose}</Badge>
            <Button variant="ghost" size="sm" onClick={isEditing ? handleSave : onEdit}>
              {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isEditing ? (
          <div className="space-y-2">
            <EditableField label="标题" value={data.title} onChange={(v) => setData({ ...data, title: v })} />
            <EditableField label="描述" value={data.description} onChange={(v) => setData({ ...data, description: v })} />
            <EditableField label="目的" value={data.purpose} onChange={(v) => setData({ ...data, purpose: v })} />
            <EditableField label="情绪" value={data.emotion} onChange={(v) => setData({ ...data, emotion: v })} />
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{data.description}</p>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>情绪：{data.emotion}</span>
              {data.foreshadowing && <span>伏笔：{data.foreshadowing}</span>}
              {data.twist && <span>反转：{data.twist}</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ForeshadowingCard({ pair }: { pair: ForeshadowingTwistPair }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4" />
          <CardTitle className="text-sm">伏笔 {pair.pair_id} → 反转 {pair.pair_id}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">伏笔</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">位置：</span>{pair.foreshadowing.location}</p>
              <p><span className="text-muted-foreground">内容：</span>{pair.foreshadowing.content}</p>
              <p><span className="text-muted-foreground">隐蔽度：</span>{pair.foreshadowing.subtlety}/10</p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">反转</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">位置：</span>{pair.twist.location}</p>
              <p><span className="text-muted-foreground">揭露：</span>{pair.twist.reveal}</p>
              <p><span className="text-muted-foreground">冲击力：</span>{pair.twist.impact}/10</p>
            </div>
          </div>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">回看满足感：</span>{pair.twist.satisfaction}
        </p>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-sm px-2 py-1 border rounded-none bg-background"
      />
    </div>
  );
}
