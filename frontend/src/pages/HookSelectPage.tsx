import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import StepNavigator from '@/components/StepNavigator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import type { GeneratedHook } from '@/types/shortStory';
import {
  Search,
  Shuffle,
  PenLine,
  Loader2,
  Zap,
  Heart,
  Skull,
  Eye,
  Flame,
  HelpCircle,
  BookOpen,
  Sparkles,
  Wand2,
  Save,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

/**
 * Step 2: 核心爽点选择页面
 * 支持三种方式：AI 生成、预设库选择、手动输入
 */
export default function HookSelectPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    categoryConfig,
    categoryMetadata,
    generatedHooks,
    isGeneratingHooks,
    presetHooks,
    hookCategories,
    isLoadingHooks,
    customHookInput,
    fetchPresetHooks,
    fetchHookCategories,
    setCustomHookInput,
    generateHooks,
    selectHook,
    randomCombine,
    loadSetting,
    loadCategoryMetadata,
    loadCategoryConfig,
    setCoreHook,
    setCustomHook,
    loadProgress,
  } = useShortStoryStore();
  void categoryMetadata;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHookId, setSelectedHookId] = useState<string | number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToPresetMap, setSaveToPresetMap] = useState<Record<string | number, boolean>>({});
  const [customRequirement, setCustomRequirement] = useState('');
  const [activeTab, setActiveTab] = useState<'ai' | 'preset' | 'custom'>('ai');
  const [presetSourceFilter, setPresetSourceFilter] = useState<'all' | 'system' | 'user'>('all');

  // 获取当前选中爽点的 saveToPreset 状态
  const getSaveToPreset = (hookId: string | number) => saveToPresetMap[hookId] || false;
  const setSaveToPresetForHook = (hookId: string | number, value: boolean) => {
    setSaveToPresetMap(prev => ({ ...prev, [hookId]: value }));
  };

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  useEffect(() => {
    loadCategoryMetadata();
    fetchHookCategories();
    fetchPresetHooks();
  }, [loadCategoryMetadata, fetchHookCategories, fetchPresetHooks]);

  useEffect(() => {
    if (novelId) {
      loadSetting(novelId);
      loadCategoryConfig(novelId);
    }
  }, [novelId, loadSetting, loadCategoryConfig]);

  useEffect(() => {
    fetchPresetHooks(selectedCategory || undefined);
  }, [selectedCategory, fetchPresetHooks]);

  useEffect(() => {
    // source 过滤变化时重新获取
    if (activeTab === 'preset') {
      fetchPresetHooks(selectedCategory || undefined, presetSourceFilter === 'all' ? undefined : presetSourceFilter);
    }
  }, [presetSourceFilter, activeTab, selectedCategory, fetchPresetHooks]);

  // AI 生成爽点
  const handleGenerateHooks = async () => {
    if (!novelId) return;
    const hooks = await generateHooks(novelId, {
      count: 3,
      custom_requirement: customRequirement || undefined,
    });
    if (hooks.length > 0) {
      showToast(`已生成 ${hooks.length} 个爽点候选`, 'success');
    }
  };

  // 选择 AI 生成或自定义爽点
  const handleSelectHook = async (hook?: GeneratedHook) => {
    if (!novelId) return;
    setIsSaving(true);
    try {
      const hookId = hook?.hook_id ?? 'custom';
      const shouldSaveToPreset = getSaveToPreset(hookId);
      if (hook) {
        await selectHook(novelId, {
          hook_id: hook.hook_id,
          hook_title: hook.title,
          hook_description: hook.description,
          emotional_target: hook.emotional_target,
          save_to_preset: shouldSaveToPreset,
        });
      } else {
        // 自定义输入
        await selectHook(novelId, {
          custom_hook: customHookInput.trim(),
          emotional_target: '爽',
          save_to_preset: shouldSaveToPreset,
        });
      }
      showToast('爽点已设置', 'success');
      navigate(`/plans?novelId=${novelId}`);
    } catch (err) {
      // store 已处理错误
    } finally {
      setIsSaving(false);
    }
  };

  // 从预设库选择
  const handleSelectPresetHook = async (hookId: string) => {
    if (!novelId) return;
    setSelectedHookId(hookId);
    setIsSaving(true);
    try {
      await setCoreHook(novelId, hookId);
      showToast('爽点已选择', 'success');
      navigate(`/plans?novelId=${novelId}`);
    } catch (err) {
      // store 已处理错误
    } finally {
      setIsSaving(false);
    }
  };

  // 手动输入爽点（旧方式兼容）
  const handleCustomHook = async () => {
    if (!novelId || !customHookInput.trim()) return;
    setIsSaving(true);
    try {
      await setCustomHook(novelId, customHookInput, undefined, getSaveToPreset('custom'));
      showToast('自定义爽点已设置', 'success');
      navigate(`/plans?novelId=${novelId}`);
    } catch (err) {
      // store 已处理错误
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandom = async () => {
    if (!novelId) return;
    await randomCombine();
    showToast('随机组合已生成', 'success');
    navigate(`/plans?novelId=${novelId}`);
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    identity_twist: <Eye className="w-4 h-4" />,
    revenge: <Flame className="w-4 h-4" />,
    romance: <Heart className="w-4 h-4" />,
    rebirth: <Sparkles className="w-4 h-4" />,
    system: <Zap className="w-4 h-4" />,
    mystery: <HelpCircle className="w-4 h-4" />,
    redemption: <Heart className="w-4 h-4" />,
    misunderstanding: <Shuffle className="w-4 h-4" />,
    reunion: <BookOpen className="w-4 h-4" />,
    survival: <Skull className="w-4 h-4" />,
    mentor: <Eye className="w-4 h-4" />,
    competition: <Flame className="w-4 h-4" />,
  };

  const categoryNames: Record<string, string> = {
    identity_twist: '身份反转',
    revenge: '打脸复仇',
    romance: '先婚后爱',
    rebirth: '重生逆袭',
    system: '系统金手指',
    mystery: '悬疑揭秘',
    redemption: '情感救赎',
    misunderstanding: '错位误会',
    reunion: '意外重逢',
    survival: '极限求生',
    mentor: '师徒传承',
    competition: '竞争博弈',
  };

  const filteredHooks = (() => {
    let hooks = searchQuery
      ? presetHooks.filter(
          (h) =>
            h.title.includes(searchQuery) ||
            h.description.includes(searchQuery)
        )
      : presetHooks;
    // 按 source 过滤
    if (presetSourceFilter !== 'all') {
      hooks = hooks.filter((h) => h.source === presetSourceFilter);
    }
    return hooks;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={2}
          onStepClick={handleStepClick}
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Step 2: 选择核心爽点</h1>
              <p className="text-sm text-muted-foreground">
                基于已选分类标签，选择或生成故事的核心驱动力
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRandom} className="rounded-none">
              <Shuffle className="w-4 h-4 mr-2" />
              随机组合
            </Button>
          </div>

          {/* 已选分类标签 */}
          {categoryConfig && (
            <Card className="rounded-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">已选分类标签</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="rounded-none">{categoryConfig.main_category}</Badge>
                  <Badge variant="outline" className="rounded-none">{categoryConfig.gender_orientation}</Badge>
                  {categoryConfig.plot_tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-none">{tag}</Badge>
                  ))}
                  {categoryConfig.character_tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-none">{tag}</Badge>
                  ))}
                  {categoryConfig.emotion_process && (
                    <Badge variant="secondary" className="rounded-none">{categoryConfig.emotion_process}</Badge>
                  )}
                  {categoryConfig.story_background && (
                    <Badge variant="secondary" className="rounded-none">{categoryConfig.story_background}</Badge>
                  )}
                  {categoryConfig.custom_tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="rounded-none">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 方式切换 */}
          <div className="flex border-b">
            {[
              { key: 'ai', label: '方式A：AI 生成爽点', icon: Wand2 },
              { key: 'preset', label: '方式B：从预设库选择', icon: BookOpen },
              { key: 'custom', label: '方式C：手动输入', icon: PenLine },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 text-sm border-b-2 transition-colors rounded-none ${
                  activeTab === tab.key
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 方式 A：AI 生成 */}
          {activeTab === 'ai' && (
            <Card className="rounded-none">
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Wand2 className="w-4 h-4 mr-2" />
                  AI 生成爽点（推荐）
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">额外要求（可选）</label>
                  <Textarea
                    placeholder="比如：希望有反转、不要太狗血、主角要有成长..."
                    value={customRequirement}
                    onChange={(e) => setCustomRequirement(e.target.value)}
                    rows={2}
                    className="rounded-none"
                  />
                </div>
                <Button onClick={handleGenerateHooks} disabled={isGeneratingHooks} className="rounded-none">
                  {isGeneratingHooks ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> 生成爽点</>
                  )}
                </Button>

                {/* 生成的爽点候选 */}
                {generatedHooks.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm font-medium">生成的爽点候选：</p>
                    {generatedHooks.map((hook) => (
                      <Card
                        key={hook.hook_id}
                        className={`rounded-none cursor-pointer transition-colors ${
                          selectedHookId === hook.hook_id
                            ? 'border-foreground bg-accent/30 ring-1 ring-foreground'
                            : 'border-border hover:border-foreground'
                        }`}
                        onClick={() => setSelectedHookId(hook.hook_id)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Badge className="rounded-none">{hook.hook_id}</Badge>
                              <span className="font-medium">{hook.title}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {selectedHookId === hook.hook_id && (
                                <Badge variant="default" className="rounded-none">已选</Badge>
                              )}
                              <Badge variant="outline" className="rounded-none">{hook.emotional_target}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{hook.description}</p>
                          <p className="text-xs text-muted-foreground">💡 {hook.why_it_works}</p>
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`save-${hook.hook_id}`}
                                checked={getSaveToPreset(hook.hook_id)}
                                onCheckedChange={(checked) => setSaveToPresetForHook(hook.hook_id, checked as boolean)}
                              />
                              <label htmlFor={`save-${hook.hook_id}`} className="text-sm flex items-center">
                                <Save className="w-3 h-3 inline mr-1" />保存到预设库
                              </label>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSelectHook(hook)}
                              disabled={isSaving}
                              className="rounded-none"
                            >
                              <ArrowRight className="w-4 h-4 mr-1" /> 选择
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 方式 B：预设库 */}
          {activeTab === 'preset' && (
            <Card className="rounded-none">
              <CardHeader>
                <CardTitle className="text-sm">从预设库选择</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 h-[500px]">
                  {/* 左侧分类 */}
                  <div className="w-full md:w-48 border-r pr-3 space-y-2 overflow-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase">分类</p>
                    <Button
                      variant={selectedCategory === null ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start rounded-none"
                      onClick={() => setSelectedCategory(null)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      全部
                    </Button>
                    {hookCategories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start rounded-none"
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        {categoryIcons[cat.id] || <Sparkles className="w-4 h-4" />}
                        <span className="ml-2">{categoryNames[cat.id] || cat.id}</span>
                        <Badge variant="outline" className="ml-auto text-xs rounded-none">
                          {cat.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>

                  {/* 右侧内容 */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 来源过滤 */}
                    <div className="flex items-center space-x-2 mb-3">
                      <Button
                        variant={presetSourceFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="rounded-none"
                        onClick={() => setPresetSourceFilter('all')}
                      >
                        全部
                      </Button>
                      <Button
                        variant={presetSourceFilter === 'system' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="rounded-none"
                        onClick={() => setPresetSourceFilter('system')}
                      >
                        系统预设
                      </Button>
                      <Button
                        variant={presetSourceFilter === 'user' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="rounded-none"
                        onClick={() => setPresetSourceFilter('user')}
                      >
                        我的爽点
                      </Button>
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索爽点..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-none"
                      />
                    </div>

                    <ScrollArea className="flex-1">
                      {isLoadingHooks ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : filteredHooks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                          <AlertCircle className="w-8 h-8 text-muted-foreground" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">未找到匹配的爽点</p>
                            <p className="text-xs text-muted-foreground">
                              尝试其他关键词，或使用 AI 生成 / 手动输入
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="rounded-none">
                              清空搜索
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setActiveTab('custom')} className="rounded-none">
                              手动输入
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pr-3">
                          {filteredHooks.map((hook) => (
                            <Card
                              key={hook.id}
                              className={`rounded-none cursor-pointer transition-colors ${
                                selectedHookId === hook.id
                                  ? 'border-foreground bg-accent/30 ring-1 ring-foreground'
                                  : 'border-border hover:border-foreground'
                              }`}
                              onClick={() => setSelectedHookId(hook.id)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">{hook.title}</CardTitle>
                                  <div className="flex items-center space-x-1">
                                    {hook.source === 'user' && (
                                      <Badge variant="default" className="text-xs rounded-none">我的</Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs rounded-none">
                                      {categoryNames[hook.category] || hook.category}
                                    </Badge>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {hook.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <Badge variant="secondary" className="text-xs rounded-none">
                                    {hook.emotional_target}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectPresetHook(hook.id)}
                                    disabled={isSaving}
                                    className="rounded-none"
                                  >
                                    选择
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 方式 C：手动输入 */}
          {activeTab === 'custom' && (
            <Card className="rounded-none">
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <PenLine className="w-4 h-4 mr-2" />
                  手动输入
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="描述你的核心爽点..."
                  value={customHookInput}
                  onChange={(e) => setCustomHookInput(e.target.value)}
                  rows={4}
                  className="rounded-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-custom"
                      checked={getSaveToPreset('custom')}
                      onCheckedChange={(checked) => setSaveToPresetForHook('custom', checked as boolean)}
                    />
                    <label htmlFor="save-custom" className="text-sm flex items-center">
                      <Save className="w-3 h-3 inline mr-1" />保存到预设库
                    </label>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCustomHook}
                    disabled={!customHookInput.trim() || isSaving}
                    className="rounded-none"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" /> 选择
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* 底部导航 */}
          <div className="flex justify-between pb-6">
            <Button
              variant="outline"
              onClick={() => navigate(`/categories?novelId=${novelId}`)}
              className="rounded-none"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              上一步
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
