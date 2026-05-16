import { ref, computed } from 'vue'
import { buildSmartShareUrl } from '../utils/shareLink'
import type { ProjectData } from '../utils/projectStorage'

type CopyStatus = 'idle' | 'copied'

export function useShareLink(getProjectData: () => ProjectData) {
  const shareResult = computed(() => buildSmartShareUrl(getProjectData()))
  const copyStatus = ref<CopyStatus>('idle')

  function copyShareLink() {
    const { url, tier } = shareResult.value
    if (tier === 'too-long' || !url) return
    navigator.clipboard.writeText(url)
    copyStatus.value = 'copied'
    setTimeout(() => (copyStatus.value = 'idle'), 2500)
  }

  const bugReportUrl = computed(() => {
    const base = 'https://github.com/MariuszDabrowski/ticket-timeline/issues/new'
    const { url, tier } = shareResult.value
    const shareSection = tier !== 'too-long' && url
      ? `## Share link\n\n${url}\n\n`
      : `## Share link\n\n<!-- Project is too large to encode as a share link -->\n\n`
    const body = `## What happened?\n\n<!-- A clear description of the bug -->\n\n## Steps to reproduce\n\n1. \n2. \n3. \n\n## Screenshot\n\n<!-- Drag and drop a screenshot here -->\n\n${shareSection}## Environment\n\n- **Device:** \n- **OS:** \n- **Browser:** `
    return `${base}?template=bug_report.md&body=${encodeURIComponent(body)}`
  })

  return { shareResult, copyStatus, copyShareLink, bugReportUrl }
}
