<script>
  import { onMount } from 'svelte'
  import {
    appendTextFile,
    copy,
    exists,
    forgetFolder,
    getFolderInfo,
    listFolders,
    mkdir,
    move,
    pickFolder,
    readFile,
    readDir,
    readTextFile,
    rename,
    removeDir,
    removeFile,
    stat,
    truncate,
    writeFile,
    writeTextFile,
  } from 'tauri-plugin-scoped-storage-api'

  const SAMPLE_TEXT_FILE = 'scoped-storage-check.txt'
  const SAMPLE_BINARY_FILE = 'scoped-storage.bin'

  let folders = $state([])
  let folder = $state(null)
  let entries = $state([])
  let sampleContents = $state('')
  let infoSummary = $state('')
  let logLines = $state([])
  let busy = $state(false)
  let browsePath = $state('')
  let textPath = $state(SAMPLE_TEXT_FILE)
  let textContents = $state('Scoped storage works.\n')
  let appendContents = $state('Appended from the demo.\n')
  let binaryPath = $state(SAMPLE_BINARY_FILE)
  let directoryPath = $state('demo-folder')
  let copyFromPath = $state(SAMPLE_TEXT_FILE)
  let copyToPath = $state('copies/copied-check.txt')
  let moveFromPath = $state('copies/copied-check.txt')
  let moveToPath = $state('moved/moved-check.txt')
  let renameFromPath = $state('moved/moved-check.txt')
  let renameToPath = $state('moved/renamed-check.txt')
  let removeFilePath = $state('moved/renamed-check.txt')
  let removeDirPath = $state('demo-folder')
  let truncatePath = $state(SAMPLE_TEXT_FILE)
  let truncateLength = $state(12)

  function log(message) {
    logLines = [`[${new Date().toLocaleTimeString()}] ${message}`, ...logLines].slice(0, 8)
  }

  function formatError(error) {
    if (!error) {
      return 'Unknown error'
    }

    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'object') {
      const candidate =
        ('message' in error && typeof error.message === 'object' && error.message) ||
        ('error' in error && typeof error.error === 'object' && error.error) ||
        error

      if (
        candidate &&
        typeof candidate === 'object' &&
        'code' in candidate &&
        'message' in candidate &&
        typeof candidate.code === 'string' &&
        typeof candidate.message === 'string'
      ) {
        return `${candidate.code}: ${candidate.message}`
      }

      if ('message' in error && typeof error.message === 'string') {
        return error.message
      }

      try {
        return JSON.stringify(error)
      } catch {
        return '[unserializable error object]'
      }
    }

    return String(error)
  }

  async function runAction(label, action) {
    busy = true
    try {
      await action()
    } catch (error) {
      log(`${label} failed: ${formatError(error)}`)
    } finally {
      busy = false
    }
  }

  async function refreshFolders() {
    folders = await listFolders()
    if (folder) {
      folder = folders.find((entry) => entry.id === folder.id) || null
    }
  }

  onMount(() => {
    return runAction('Restore folders', async () => {
      await refreshFolders()
      if (folders.length) {
        log(`Restored ${folders.length} saved folder handle${folders.length === 1 ? '' : 's'}.`)
      }
    })
  })

  async function refreshEntries() {
    if (!folder) {
      return
    }

    entries = await readDir(folder.id, browsePath || undefined)
    log(`Loaded ${entries.length} item${entries.length === 1 ? '' : 's'} from ${browsePath || folder.name || 'folder'}.`)
  }

  function connectFolder() {
    return runAction('Pick folder', async () => {
      folder = await pickFolder()
      await refreshFolders()
      sampleContents = ''
      infoSummary = ''
      await refreshEntries()
    })
  }

  function loadFolderInfo() {
    return runAction('Get folder info', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      folder = await getFolderInfo(folder.id)
      infoSummary = `${folder.name || 'Folder'} (${folder.id})`
      log(`Loaded folder info for ${folder.name || folder.id}.`)
    })
  }

  function writeSampleTextFile() {
    return runAction('Write text file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await writeTextFile(folder.id, textPath, `${textContents}${new Date().toISOString()}\n`, { recursive: true })
      log(`Wrote text file at ${textPath}.`)
      await refreshEntries()
    })
  }

  function readSampleTextFile() {
    return runAction('Read text file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      if (!(await exists(folder.id, textPath))) {
        log(`${textPath} does not exist yet.`)
        sampleContents = ''
        return
      }

      sampleContents = await readTextFile(folder.id, textPath)
      const info = await stat(folder.id, textPath)
      log(`Read ${textPath} (${info.size ?? sampleContents.length} bytes).`)
    })
  }

  function appendSampleTextFile() {
    return runAction('Append text file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await appendTextFile(folder.id, textPath, appendContents, { recursive: true, create: true })
      log(`Appended text to ${textPath}.`)
      sampleContents = await readTextFile(folder.id, textPath)
    })
  }

  function writeBinaryFile() {
    return runAction('Write binary file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 42, 99])
      await writeFile(folder.id, binaryPath, bytes, { mimeType: 'application/octet-stream', recursive: true })
      log(`Wrote ${bytes.byteLength} binary bytes to ${binaryPath}.`)
      await refreshEntries()
    })
  }

  function readBinaryFile() {
    return runAction('Read binary file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      const data = await readFile(folder.id, binaryPath)
      log(`Read ${data.byteLength} binary bytes from ${binaryPath}: ${Array.from(data).join(', ')}.`)
    })
  }

  function createDirectory() {
    return runAction('Create directory', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await mkdir(folder.id, directoryPath, true)
      log(`Created directory ${directoryPath}.`)
      await refreshEntries()
    })
  }

  function copyEntry() {
    return runAction('Copy entry', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await copy(folder.id, copyFromPath, folder.id, copyToPath)
      log(`Copied ${copyFromPath} to ${copyToPath}.`)
      await refreshEntries()
    })
  }

  function moveEntry() {
    return runAction('Move entry', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await move(folder.id, moveFromPath, folder.id, moveToPath)
      log(`Moved ${moveFromPath} to ${moveToPath}.`)
      await refreshEntries()
    })
  }

  function renameEntry() {
    return runAction('Rename entry', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await rename(folder.id, renameFromPath, renameToPath)
      log(`Renamed ${renameFromPath} to ${renameToPath}.`)
      await refreshEntries()
    })
  }

  function truncateEntry() {
    return runAction('Truncate file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await truncate(folder.id, truncatePath, Number(truncateLength))
      log(`Truncated ${truncatePath} to ${truncateLength} bytes.`)
      sampleContents = await readTextFile(folder.id, truncatePath)
    })
  }

  function removeSelectedFile() {
    return runAction('Remove file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await removeFile(folder.id, removeFilePath)
      log(`Removed file ${removeFilePath}.`)
      await refreshEntries()
    })
  }

  function removeSelectedDirectory() {
    return runAction('Remove directory', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      await removeDir(folder.id, removeDirPath, true)
      log(`Removed directory ${removeDirPath}.`)
      await refreshEntries()
    })
  }

  function readBinaryMetadata() {
    return runAction('Stat text file', async () => {
      if (!folder) {
        log('Pick a folder first.')
        return
      }

      const info = await stat(folder.id, textPath)
      log(`Stat for ${textPath}: ${JSON.stringify(info)}.`)
    })
  }

  function disconnectFolder() {
    return runAction('Forget folder', async () => {
      if (!folder) {
        return
      }

      await forgetFolder(folder.id)
      log(`Forgot ${folder.name || 'folder'} handle.`)
      folder = null
      await refreshFolders()
      entries = []
      sampleContents = ''
      infoSummary = ''
    })
  }

  function selectFolder(savedFolder) {
    return runAction('Load saved folder', async () => {
      folder = savedFolder
      infoSummary = `${savedFolder.name || 'Folder'} (${savedFolder.id})`
      await refreshEntries()
    })
  }
</script>

<main class="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
  <section class="surface-card overflow-hidden">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="max-w-2xl">
        <p class="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-moss/80">Scoped Storage Demo</p>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Mobile-first folder access, tested for real
        </h1>
        <p class="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          Pick a folder on Android or iOS, then run text, binary, directory, copy, move, rename,
          and truncate operations through the plugin API.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <button class="action-button" onclick={connectFolder} disabled={busy}>Pick Folder</button>
        <button class="secondary-button" onclick={refreshFolders} disabled={busy}>Reload Handles</button>
        <button class="secondary-button" onclick={loadFolderInfo} disabled={busy || !folder}>Get Info</button>
        <button class="secondary-button" onclick={refreshEntries} disabled={busy || !folder}>Read Dir</button>
        <button class="secondary-button" onclick={readBinaryMetadata} disabled={busy || !folder}>Stat File</button>
        <button class="danger-button" onclick={disconnectFolder} disabled={busy || !folder}>Forget</button>
      </div>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div class="rounded-[24px] bg-slate-950 px-5 py-5 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-amber-200/70">Current Folder</p>
            <p class="mt-2 text-lg font-semibold">{folder?.name || 'Waiting for selection'}</p>
          </div>
          <span class={`rounded-full px-3 py-1 text-xs font-medium ${folder ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
            {folder ? 'Connected' : 'Idle'}
          </span>
        </div>

        {#if folder}
          <dl class="mt-5 grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <dt class="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">Handle ID</dt>
              <dd class="mt-1 break-all text-slate-100">{folder.id}</dd>
            </div>
            <div>
              <dt class="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">Saved Handles</dt>
              <dd class="mt-1 text-slate-100">{folders.length}</dd>
            </div>
            <div>
              <dt class="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">Summary</dt>
              <dd class="mt-1 text-slate-100">{infoSummary || 'Ready for file operations'}</dd>
            </div>
          </dl>
        {:else}
          <p class="mt-5 text-sm leading-6 text-slate-300">
            Choose a folder to start testing persisted scoped-storage access.
          </p>
        {/if}
      </div>

      <div class="rounded-[24px] border border-white/60 bg-white/70 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Saved Handles</p>
            <p class="mt-1 text-sm text-slate-600">Tap one to restore it into the active session.</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{folders.length}</span>
        </div>

        {#if folders.length}
          <div class="mt-4 flex flex-wrap gap-2">
            {#each folders as savedFolder}
              <button class="chip-button" onclick={() => selectFolder(savedFolder)} disabled={busy}>
                <span class="h-2 w-2 rounded-full bg-sun"></span>
                {savedFolder.name || savedFolder.id}
              </button>
            {/each}
          </div>
        {:else}
          <p class="mt-4 text-sm text-slate-500">No saved folder handles yet.</p>
        {/if}
      </div>
    </div>
  </section>

  <section class="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
    <article class="surface-card">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Directory Browser</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-900">Entries</h2>
        </div>
        <span class="rounded-full bg-fog px-3 py-1 text-xs font-medium text-slate-600">{entries.length}</span>
      </div>

      <label class="block">
        <span class="field-label">Read Dir Path</span>
        <input class="field-input" bind:value={browsePath} placeholder="Leave empty for the folder root" />
      </label>

      <div class="mt-4 space-y-3">
        {#if entries.length}
          {#each entries as entry}
            <div class="rounded-2xl border border-slate-200/70 bg-fog/80 px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
                  <p class="mt-1 truncate text-xs text-slate-500">{entry.path}</p>
                </div>
                <span class={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${entry.isDir ? 'bg-moss/10 text-moss' : 'bg-sun/20 text-amber-700'}`}>
                  {entry.isDir ? 'Directory' : `${entry.size ?? 0} bytes`}
                </span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
            No entries loaded yet. Read the root folder or point at a nested relative path.
          </div>
        {/if}
      </div>
    </article>

    <article class="surface-card">
      <div class="mb-4">
        <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Text Workflow</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">UTF-8 Read, Write, and Append</h2>
      </div>

      <label class="block">
        <span class="field-label">Path</span>
        <input class="field-input" bind:value={textPath} />
      </label>

      <label class="mt-4 block">
        <span class="field-label">Write Contents</span>
        <textarea class="field-input min-h-28 resize-y" bind:value={textContents} rows="4"></textarea>
      </label>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <button class="action-button" onclick={writeSampleTextFile} disabled={busy || !folder}>Write Text</button>
        <button class="secondary-button" onclick={readSampleTextFile} disabled={busy || !folder}>Read Text</button>
      </div>

      <label class="mt-4 block">
        <span class="field-label">Append Contents</span>
        <textarea class="field-input min-h-24 resize-y" bind:value={appendContents} rows="3"></textarea>
      </label>

      <div class="mt-4">
        <button class="secondary-button w-full" onclick={appendSampleTextFile} disabled={busy || !folder}>Append Text</button>
      </div>

      <div class="mt-4 rounded-[24px] bg-slate-950 p-4 text-sm text-slate-100">
        <p class="mb-3 text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">Latest Read Result</p>
        {#if sampleContents}
          <pre class="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.82rem] leading-6 text-emerald-100">{sampleContents}</pre>
        {:else}
          <p class="text-slate-400">Read the current text file to inspect what the plugin returned.</p>
        {/if}
      </div>
    </article>
  </section>

  <section class="grid gap-4 xl:grid-cols-3">
    <article class="surface-card">
      <div class="mb-4">
        <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Binary + Directory</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">Byte IO and Folder Creation</h2>
      </div>

      <label class="block">
        <span class="field-label">Binary Path</span>
        <input class="field-input" bind:value={binaryPath} />
      </label>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <button class="action-button" onclick={writeBinaryFile} disabled={busy || !folder}>Write Binary</button>
        <button class="secondary-button" onclick={readBinaryFile} disabled={busy || !folder}>Read Binary</button>
      </div>

      <label class="mt-5 block">
        <span class="field-label">Directory Path</span>
        <input class="field-input" bind:value={directoryPath} />
      </label>
      <button class="secondary-button mt-4 w-full" onclick={createDirectory} disabled={busy || !folder}>Create Directory</button>

      <label class="mt-5 block">
        <span class="field-label">Remove Dir Path</span>
        <input class="field-input" bind:value={removeDirPath} />
      </label>
      <button class="danger-button mt-4 w-full" onclick={removeSelectedDirectory} disabled={busy || !folder}>Remove Directory</button>
    </article>

    <article class="surface-card">
      <div class="mb-4">
        <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Copy + Move</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">Cross-path File Flow</h2>
      </div>

      <label class="block">
        <span class="field-label">Copy From</span>
        <input class="field-input" bind:value={copyFromPath} />
      </label>
      <label class="mt-4 block">
        <span class="field-label">Copy To</span>
        <input class="field-input" bind:value={copyToPath} />
      </label>
      <button class="secondary-button mt-4 w-full" onclick={copyEntry} disabled={busy || !folder}>Copy Entry</button>

      <label class="mt-5 block">
        <span class="field-label">Move From</span>
        <input class="field-input" bind:value={moveFromPath} />
      </label>
      <label class="mt-4 block">
        <span class="field-label">Move To</span>
        <input class="field-input" bind:value={moveToPath} />
      </label>
      <button class="secondary-button mt-4 w-full" onclick={moveEntry} disabled={busy || !folder}>Move Entry</button>
    </article>

    <article class="surface-card">
      <div class="mb-4">
        <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Rename + Truncate</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">Mutation Checks</h2>
      </div>

      <label class="block">
        <span class="field-label">Rename From</span>
        <input class="field-input" bind:value={renameFromPath} />
      </label>
      <label class="mt-4 block">
        <span class="field-label">Rename To</span>
        <input class="field-input" bind:value={renameToPath} />
      </label>
      <button class="secondary-button mt-4 w-full" onclick={renameEntry} disabled={busy || !folder}>Rename Entry</button>

      <label class="mt-5 block">
        <span class="field-label">Truncate Path</span>
        <input class="field-input" bind:value={truncatePath} />
      </label>
      <label class="mt-4 block">
        <span class="field-label">Truncate Length</span>
        <input class="field-input" bind:value={truncateLength} type="number" min="0" />
      </label>
      <button class="secondary-button mt-4 w-full" onclick={truncateEntry} disabled={busy || !folder}>Truncate File</button>

      <label class="mt-5 block">
        <span class="field-label">Remove File Path</span>
        <input class="field-input" bind:value={removeFilePath} />
      </label>
      <button class="danger-button mt-4 w-full" onclick={removeSelectedFile} disabled={busy || !folder}>Remove File</button>
    </article>
  </section>

  <section class="surface-card">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <p class="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Activity</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">Structured Event Log</h2>
      </div>
      <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{logLines.length}</span>
    </div>

    {#if logLines.length}
      <div class="space-y-3">
        {#each logLines as line}
          <div class="rounded-2xl border border-slate-200/70 bg-fog/80 px-4 py-3 text-sm leading-6 text-slate-700">
            {line}
          </div>
        {/each}
      </div>
    {:else}
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
        Actions and structured plugin errors will appear here as you exercise the mobile bridge.
      </div>
    {/if}
  </section>
</main>
