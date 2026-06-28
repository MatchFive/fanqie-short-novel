import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useShortStoryStore } from '@/stores/shortStoryStore';
import { useAppStore } from '@/stores/appStore';
import StepNavigator from '@/components/StepNavigator';
import type { CategoryConfigCreate, PlotCategory } from '@/types/shortStory';
import { ArrowRight, Tag, X, Loader2, BookOpen } from 'lucide-react';

/**
 * Step 1: 番茄分类标签配置页面
 */
export default function CategoryConfigPage() {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId');
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    categoryConfig,
    categoryMetadata,
    isLoadingCategoryMetadata,
    loadCategoryMetadata,
    loadCategoryConfig,
    saveCategoryConfig,
    loadProgress,
    loadSetting,
  } = useShortStoryStore();

  // 表单状态
  const [mainCategory, setMainCategory] = useState('');
  const [plotLevel1, setPlotLevel1] = useState('');
  const [plotLevel2, setPlotLevel2] = useState('');
  const [plotLevel3, setPlotLevel3] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [emotionProcess, setEmotionProcess] = useState('');
  const [storyBackground, setStoryBackground] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [targetLength, setTargetLength] = useState<number>(8000);
  const [isSaving, setIsSaving] = useState(false);

  // 加载进度（统一来源）
  useEffect(() => {
    if (novelId) {
      loadProgress(novelId);
    }
  }, [novelId, loadProgress]);

  // 加载元数据（全局数据，只加载一次）
  useEffect(() => {
    loadCategoryMetadata();
  }, [loadCategoryMetadata]);

  // 加载已有配置（每次进入页面都加载）
  useEffect(() => {
    if (!novelId) return;
    loadCategoryConfig(novelId);
  }, [novelId, loadCategoryConfig]);

  // 加载已有配置（包含 target_length）
  useEffect(() => {
    if (!novelId) return;
    loadSetting(novelId);
  }, [novelId, loadSetting]);

  // 回填已有配置
  useEffect(() => {
    if (categoryConfig) {
      setMainCategory(categoryConfig.main_category);
      setPlotLevel1(categoryConfig.plot_level1 || '');
      setPlotLevel2(categoryConfig.plot_level2 || '');
      setPlotLevel3(categoryConfig.plot_level3 || '');
      setSelectedCharacters(categoryConfig.character_tags || []);
      setEmotionProcess(categoryConfig.emotion_process || '');
      setStoryBackground(categoryConfig.story_background || '');
      setCustomTags(categoryConfig.custom_tags || []);
      setTargetLength(categoryConfig.target_length || 8000);
    }
  }, [categoryConfig]);

  // 当前选中的主分类信息
  const selectedMainCategory = useMemo(() => {
    return categoryMetadata?.main_categories.find((c) => c.name === mainCategory);
  }, [categoryMetadata, mainCategory]);

  // 情节分类联动选项
  const plotLevel1Options = useMemo(() => {
    if (!categoryMetadata) return [];
    return Array.from(new Set(categoryMetadata.plot_categories.map((p) => p.level1)));
  }, [categoryMetadata]);

  const plotLevel2Options = useMemo(() => {
    if (!categoryMetadata || !plotLevel1) return [];
    return Array.from(
      new Set(
        categoryMetadata.plot_categories
          .filter((p) => p.level1 === plotLevel1)
          .map((p) => p.level2)
      )
    );
  }, [categoryMetadata, plotLevel1]);

  const plotLevel3Options = useMemo(() => {
    if (!categoryMetadata || !plotLevel1 || !plotLevel2) return [];
    return categoryMetadata.plot_categories.filter(
      (p) => p.level1 === plotLevel1 && p.level2 === plotLevel2
    );
  }, [categoryMetadata, plotLevel1, plotLevel2]);

  const currentPlotCategory: PlotCategory | undefined = useMemo(() => {
    if (!categoryMetadata || !plotLevel3) return undefined;
    return categoryMetadata.plot_categories.find((p) => p.level3 === plotLevel3);
  }, [categoryMetadata, plotLevel3]);

  // 当一级改变时重置下级
  const handlePlotLevel1Change = (value: string) => {
    setPlotLevel1(value);
    setPlotLevel2('');
    setPlotLevel3('');
  };

  const handlePlotLevel2Change = (value: string) => {
    setPlotLevel2(value);
    setPlotLevel3('');
  };

  // 角色关键词切换
  const toggleCharacterTag = (tag: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 自定义标签
  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (customTags.includes(tag)) {
      setCustomTagInput('');
      return;
    }
    setCustomTags([...customTags, tag]);
    setCustomTagInput('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleStepClick = (step: number) => {
    if (!novelId) return;
    const paths = ['categories', 'hook', 'plans', 'plan', 'chapters', 'write', 'integrate'];
    navigate(`/${paths[step - 1]}?novelId=${novelId}`);
  };

  // 保存分类配置
  const handleSave = async () => {
    if (!novelId) return;
    if (!mainCategory) {
      showToast('请选择主分类', 'error');
      return;
    }

    const data: CategoryConfigCreate = {
      main_category: mainCategory,
      gender_orientation: selectedMainCategory?.gender || '通用',
      plot_tags: currentPlotCategory ? currentPlotCategory.tags : [],
      plot_level1: plotLevel1 || undefined,
      plot_level2: plotLevel2 || undefined,
      plot_level3: plotLevel3 || undefined,
      character_tags: selectedCharacters.length > 0 ? selectedCharacters : undefined,
      emotion_process: emotionProcess || undefined,
      story_background: storyBackground || undefined,
      custom_tags: customTags.length > 0 ? customTags : undefined,
      target_length: targetLength,
    };

    setIsSaving(true);
    try {
      await saveCategoryConfig(novelId, data);
      showToast('分类配置已保存', 'success');
      navigate(`/hook?novelId=${novelId}`);
    } catch (err) {
      // 错误已在 store 中处理
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingCategoryMetadata && !categoryMetadata) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 步骤导航 */}
      <div className="border-b p-4">
        <StepNavigator
          currentStep={1}
          onStepClick={handleStepClick}
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <h1 className="text-xl font-semibold">Step 1: 配置番茄分类标签</h1>
          </div>

          {/* 主分类 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">主分类 *</CardTitle>
              <CardDescription>选择故事所属的主分类，将决定整体基调与视角</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={mainCategory} onValueChange={setMainCategory}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="请选择主分类" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {categoryMetadata?.main_categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name} className="rounded-none">
                      {cat.name}（{cat.gender}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMainCategory && (
                <div className="text-sm text-muted-foreground border p-3">
                  <p className="font-medium text-foreground">{selectedMainCategory.name}</p>
                  <p>{selectedMainCategory.description}</p>
                  <Badge variant="outline" className="mt-2 rounded-none">
                    {selectedMainCategory.gender}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 情节分类 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">情节分类</CardTitle>
              <CardDescription>三级联动选择情节标签，为 AI 生成提供情节元素约束</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">一级分类</Label>
                  <Select value={plotLevel1} onValueChange={handlePlotLevel1Change}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {plotLevel1Options.map((opt) => (
                        <SelectItem key={opt} value={opt} className="rounded-none">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">二级分类</Label>
                  <Select value={plotLevel2} onValueChange={handlePlotLevel2Change} disabled={!plotLevel1}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {plotLevel2Options.map((opt) => (
                        <SelectItem key={opt} value={opt} className="rounded-none">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">三级分类</Label>
                  <Select value={plotLevel3} onValueChange={setPlotLevel3} disabled={!plotLevel2}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {plotLevel3Options.map((opt) => (
                        <SelectItem key={opt.level3} value={opt.level3} className="rounded-none">
                          {opt.level3}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {currentPlotCategory && (
                <div className="text-sm text-muted-foreground border p-3 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {currentPlotCategory.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-none">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {currentPlotCategory.remark && <p>{currentPlotCategory.remark}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 角色关键词 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">角色关键词</CardTitle>
              <CardDescription>选择故事中需要包含的角色元素（可多选）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoryMetadata?.character_tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleCharacterTag(tag)}
                    className={`px-3 py-1 text-sm border transition-colors rounded-none ${
                      selectedCharacters.includes(tag)
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-muted hover:border-foreground'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 情绪过程 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">情绪过程</CardTitle>
              <CardDescription>选择故事整体的情绪走向</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoryMetadata?.emotion_processes.map((proc) => (
                  <button
                    key={proc}
                    onClick={() => setEmotionProcess(proc)}
                    className={`px-3 py-1 text-sm border transition-colors rounded-none ${
                      emotionProcess === proc
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-muted hover:border-foreground'
                    }`}
                  >
                    {proc}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 故事背景 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">故事背景</CardTitle>
              <CardDescription>选择故事主要发生的背景设定</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoryMetadata?.story_backgrounds.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setStoryBackground(bg)}
                    className={`px-3 py-1 text-sm border transition-colors rounded-none ${
                      storyBackground === bg
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-muted hover:border-foreground'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 目标字数 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">目标字数</CardTitle>
              <CardDescription>设置短篇小说的目标字数（影响章节拆分数量）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min={2000}
                  max={30000}
                  step={1000}
                  value={targetLength}
                  onChange={(e) => setTargetLength(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-20 text-right">{targetLength}字</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                约 {Math.round(targetLength / 1000)} 章，每章约1000字
              </p>
            </CardContent>
          </Card>

          {/* 自定义标签 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                自定义标签
              </CardTitle>
              <CardDescription>添加额外标签以进一步约束 AI 生成方向</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="输入自定义标签，按回车或点击添加"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  className="rounded-none"
                />
                <Button variant="outline" onClick={addCustomTag} className="rounded-none">
                  添加
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-none flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => removeCustomTag(tag)}
                      className="hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex justify-end pb-6">
            <Button onClick={handleSave} disabled={isSaving || !mainCategory} className="rounded-none">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</>
              ) : (
                <><span>下一步：确定爽点</span><ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
