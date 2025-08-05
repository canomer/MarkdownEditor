class MarkdownEditor {
    constructor() {
        console.log('🏗️ Starting editor construction...');
        
        this.files = {};
        this.folders = {};
        this.openFiles = []; // Array to track which files are currently open
        this.activeFile = null;
        this.previewVisible = true;
        this.fileCounter = 0;
        this.folderCounter = 0;
        this.treeView = false;
        this.splitViews = []; // Array to track split views
        this.splitMode = false;
        
        try {
            this.renderNormalView(); // Create the DOM structure first
            this.initializeEditor(); // Then reference the created elements
        this.loadFromStorage();
        this.setupEventListeners();
            
            // Now that all DOM references are set up, render the initial state
            this.renderEditor();
            this.updatePreview();
            
        this.initializeMermaid();
            
            console.log('🎉 Editor construction completed!');
        } catch (error) {
            console.error('❌ Error during editor construction:', error);
            throw error;
        }
    }

    initializeMermaid() {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ 
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#007acc',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#404040',
                    lineColor: '#404040',
                    secondaryColor: '#2d2d30',
                    tertiaryColor: '#1e1e1e'
                }
            });
        }
    }

    initializeEditor() {
        this.editorContainer = document.getElementById('editorContainer');
        this.preview = document.getElementById('preview');
        this.tabs = document.getElementById('tabs');
        this.fileTree = document.getElementById('fileTree');
        this.emptyState = document.getElementById('emptyState');
    }

    loadFromStorage() {
        const stored = localStorage.getItem('markdownEditor');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.files = data.files || {};
                this.folders = data.folders || {};
                this.openFiles = data.openFiles || [];
                this.fileCounter = data.fileCounter || 0;
                this.folderCounter = data.folderCounter || 0;
                
                if (Object.keys(this.files).length > 0) {
                    this.renderFileTree();
                    if (this.openFiles.length > 0) {
                        // Open the first open file
                        const firstOpenFile = this.openFiles[0];
                        if (this.files[firstOpenFile]) {
                            this.openFile(firstOpenFile);
                        } else {
                            // Remove invalid file from openFiles
                            this.openFiles = this.openFiles.filter(id => this.files[id]);
                            if (this.openFiles.length > 0) {
                                this.openFile(this.openFiles[0]);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load from storage:', e);
            }
        }
    }

    saveToStorage() {
        const data = {
            files: this.files,
            folders: this.folders,
            openFiles: this.openFiles,
            fileCounter: this.fileCounter,
            folderCounter: this.folderCounter
        };
        localStorage.setItem('markdownEditor', JSON.stringify(data));
    }

    createFolder(name, parentFolder = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const id = 'folder_' + (++this.folderCounter);
        this.folders[id] = {
            name: name,
            parent: parentFolder,
            expanded: true,
            created: Date.now(),
            timestamp: timestamp
        };
        this.saveToStorage();
        this.renderFileTree();
        return id;
    }

    createFile(name, content = '', parentFolder = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const id = 'file_' + (++this.fileCounter);
        
        // Add timestamp to the beginning of the content if it's empty
        let fileContent = content;
        if (!content.trim()) {
            fileContent = `# ${name.replace('.md', '')}\n\n*Created: ${new Date().toLocaleString()}*\n\n`;
        }
        
        this.files[id] = {
            name: name,
            content: fileContent,
            modified: false,
            parent: parentFolder,
            created: Date.now(),
            timestamp: timestamp
        };
        this.saveToStorage();
        this.renderFileTree();
        this.openFile(id);
        return id;
    }

    openFile(fileId, addToOpenFiles = true) {
        if (!this.files[fileId]) return;

        // Add to open files if not already there
        if (addToOpenFiles && !this.openFiles.includes(fileId)) {
            this.openFiles.push(fileId);
        }

        this.activeFile = fileId;
        
        if (this.splitMode) {
            // If we have splits, update the first split to show this file
            if (this.splitViews.length > 0) {
                this.splitViews[0].fileId = fileId;
                this.updateSplitContent(this.splitViews[0]);
            }
        } else {
        this.renderEditor();
        this.updatePreview();
        }
        
        this.renderTabs();
        this.updateStatus();
        this.saveToStorage();
        
        // Update solution explorer when file is opened
        const file = this.files[fileId];
        if (file) {
            updateSolutionExplorer(file.content);
        }
    }

    closeFile(fileId) {
        if (!this.files[fileId]) return;

        // Remove from open files
        this.openFiles = this.openFiles.filter(id => id !== fileId);
        
        if (this.activeFile === fileId) {
            if (this.openFiles.length > 0) {
                // Switch to the last opened file
                this.openFile(this.openFiles[this.openFiles.length - 1], false);
            } else {
                this.activeFile = null;
                this.renderTabs();
                this.showEmptyState();
                // Clear solution explorer when no file is active
                showEmptyExplorer();
            }
        }
        
        this.renderTabs();
        this.saveToStorage();
    }

    updateFileContent(content, fileId = null) {
        const targetFileId = fileId || this.activeFile;
        if (!targetFileId) return;
        
        this.files[targetFileId].content = content;
        this.files[targetFileId].modified = true;
        
        // Update all splits showing this file
        if (this.splitMode) {
            this.splitViews.forEach(split => {
                if (split.fileId === targetFileId) {
                    this.updateSplitPreview(split);
                }
            });
        } else {
            // Update normal preview if we're not in split mode
        this.updatePreview();
        }
        
        this.renderTabs();
        this.saveToStorage();
    }

    renderFileTree() {
        this.fileTree.innerHTML = '';
        
        if (this.treeView) {
            this.renderTreeView();
        } else {
            // Render root-level folders and files
            this.renderTreeLevel(null, this.fileTree);
        }
    }

    renderTreeView() {
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-view';
        
        const treeStructure = this.generateTreeStructure();
        treeContainer.innerHTML = treeStructure;
        
        this.fileTree.appendChild(treeContainer);
    }

    generateTreeStructure() {
        let treeHtml = '';
        
        // Generate tree structure recursively
        const buildTree = (parentId, prefix = '', isLast = true) => {
            // Get folders and files for this level
            const folders = Object.entries(this.folders)
                .filter(([id, folder]) => folder.parent === parentId)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name));
            
            const files = Object.entries(this.files)
                .filter(([id, file]) => file.parent === parentId)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name));
            
            const totalItems = folders.length + files.length;
            
            // Render folders
            folders.forEach(([id, folder], index) => {
                const isLastItem = index === totalItems - 1;
                const currentPrefix = isLastItem ? '└── ' : '├── ';
                const nextPrefix = prefix + (isLastItem ? '    ' : '│   ');
                
                treeHtml += `<div class="tree-line" onclick="editor.openFolder('${id}')">
                    <span class="tree-prefix">${prefix}${currentPrefix}</span>
                    <span class="tree-icon">📁</span>
                    <span class="tree-name">${folder.name}</span>
                    <span class="delete-btn" onclick="event.stopPropagation(); editor.deleteFolder('${id}')" title="Delete folder">🗑️</span>
                </div>`;
                
                if (folder.expanded) {
                    buildTree(id, nextPrefix, isLastItem);
                }
            });
            
            // Render files
            files.forEach(([id, file], index) => {
                const fileIndex = folders.length + index;
                const isLastItem = fileIndex === totalItems - 1;
                const currentPrefix = isLastItem ? '└── ' : '├── ';
                
                const activeClass = this.activeFile === id ? ' active' : '';
                const modifiedIndicator = file.modified ? ' •' : '';
                
                treeHtml += `<div class="tree-line${activeClass}" 
                    onclick="editor.openFile('${id}')" 
                    oncontextmenu="event.preventDefault(); editor.showFileContextMenu(event, '${id}')">
                    <span class="tree-prefix">${prefix}${currentPrefix}</span>
                    <span class="tree-icon">📄</span>
                    <span class="tree-name">${file.name}${modifiedIndicator}</span>
                    <span class="delete-btn" onclick="event.stopPropagation(); editor.deleteFile('${id}')" title="Delete file">🗑️</span>
                </div>`;
            });
        };
        
        buildTree(null);
        return treeHtml;
    }

    renderTreeLevel(parentId, container, depth = 0) {
        // First render folders
        Object.entries(this.folders)
            .filter(([id, folder]) => folder.parent === parentId)
            .sort(([,a], [,b]) => a.name.localeCompare(b.name))
            .forEach(([id, folder]) => {
                this.renderFolderItem(id, folder, container, depth);
            });
        
        // Then render files
        Object.entries(this.files)
            .filter(([id, file]) => file.parent === parentId)
            .sort(([,a], [,b]) => a.name.localeCompare(b.name))
            .forEach(([id, file]) => {
                this.renderFileItem(id, file, container, depth);
            });
    }

    renderFolderItem(id, folder, container, depth = 0) {
        const item = document.createElement('div');
        item.className = 'folder-item';
        
        // Add context menu
        item.oncontextmenu = (e) => {
            e.preventDefault();
            this.showFolderContextMenu(e, id);
        };
        
        const toggle = document.createElement('span');
        toggle.className = `folder-toggle ${folder.expanded ? 'expanded' : ''}`;
        toggle.textContent = '▶';
        toggle.onclick = (e) => {
            e.stopPropagation();
            this.toggleFolder(id);
        };
        
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = '📁';
        
        const name = document.createElement('span');
        name.textContent = folder.name;
        name.style.flex = '1';
        
        const downloadBtn = document.createElement('span');
        downloadBtn.innerHTML = '📦';
        downloadBtn.className = 'download-btn';
        downloadBtn.title = 'Download as ZIP';
        downloadBtn.style.cssText = 'cursor: pointer; opacity: 0.7; font-size: 12px; margin-left: 4px;';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            this.downloadFolderAsZip(id);
        };
        
        const deleteBtn = document.createElement('span');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete folder';
        deleteBtn.style.cssText = 'cursor: pointer; opacity: 0.7; font-size: 12px; margin-left: 4px;';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteFolder(id);
        };
        
        item.appendChild(toggle);
        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(downloadBtn);
        item.appendChild(deleteBtn);
        
        container.appendChild(item);
        
        // Render children if expanded
        if (folder.expanded) {
            const childContainer = document.createElement('div');
            childContainer.className = 'folder-children';
            childContainer.setAttribute('data-depth', Math.min(depth + 1, 4));
            this.renderTreeLevel(id, childContainer, depth + 1);
            container.appendChild(childContainer);
        }
    }

    renderFileItem(id, file, container, depth = 0) {
            const item = document.createElement('div');
            item.className = `file-item ${this.activeFile === id ? 'active' : ''}`;
            item.onclick = () => this.openFile(id);
            
        // Add context menu
        item.oncontextmenu = (e) => {
            e.preventDefault();
            this.showFileContextMenu(e, id);
        };
        
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = '📄';
        
        const name = document.createElement('span');
        name.textContent = `${file.name}${file.modified ? ' •' : ''}`;
        name.style.flex = '1';
        
        const downloadBtn = document.createElement('span');
        downloadBtn.innerHTML = '💾';
        downloadBtn.className = 'download-btn';
        downloadBtn.title = 'Download file';
        downloadBtn.style.cssText = 'cursor: pointer; opacity: 0.7; font-size: 12px; margin-left: 4px;';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            this.downloadFile(id);
        };
        
        const deleteBtn = document.createElement('span');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete file';
        deleteBtn.style.cssText = 'cursor: pointer; opacity: 0.7; font-size: 12px; margin-left: 4px;';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteFile(id);
        };
        
        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(downloadBtn);
        item.appendChild(deleteBtn);
        
        container.appendChild(item);
    }

    toggleFolder(folderId) {
        const folder = this.folders[folderId];
        if (!folder) return;
        
        folder.expanded = !folder.expanded;
        this.saveToStorage();
        this.renderFileTree();
    }

    renderTabs() {
        this.tabs.innerHTML = '';
        
        this.openFiles.forEach((fileId) => {
            const file = this.files[fileId];
            if (!file) return;
            
            const tab = document.createElement('div');
            tab.className = `tab ${this.activeFile === fileId ? 'active' : ''}`;
            tab.onclick = () => this.openFile(fileId, false);
            
            tab.innerHTML = `
                <span>${file.name}${file.modified ? ' •' : ''}</span>
                <span class="tab-close" onclick="event.stopPropagation(); editor.closeFile('${fileId}')" title="Close file">×</span>
            `;
            
            this.tabs.appendChild(tab);
        });
    }

    renderEditor() {
        if (!this.activeFile) {
            this.showEmptyState();
            return;
        }

        // Check if we're in split mode by checking if splitViews exist
        if (this.splitViews && this.splitViews.length > 0) {
            // In split mode, editor rendering is handled by split view system
            return;
        }

        const file = this.files[this.activeFile];
        this.editorContainer.innerHTML = `
            <div class="formatting-toolbar">
                <!-- Text Formatting Group -->
                <div class="toolbar-group">
                    <select class="toolbar-select" id="headingSelect" onchange="insertHeading()">
                        <option value="">Heading</option>
                        <option value="1">Heading 1</option>
                        <option value="2">Heading 2</option>
                        <option value="3">Heading 3</option>
                        <option value="4">Heading 4</option>
                        <option value="5">Heading 5</option>
                        <option value="6">Heading 6</option>
                    </select>
                </div>

                <!-- Text Style Group -->
                <div class="toolbar-group">
                    <button class="toolbar-btn" onclick="formatText('bold')" title="Bold (Ctrl+B)">
                        <span>B</span>
                    </button>
                    <button class="toolbar-btn" onclick="formatText('italic')" title="Italic (Ctrl+I)">
                        <span style="font-style: italic;">I</span>
                    </button>
                    <button class="toolbar-btn" onclick="formatText('strikethrough')" title="Strikethrough">
                        <span style="text-decoration: line-through;">S</span>
                    </button>
                    <button class="toolbar-btn" onclick="formatText('code')" title="Code">
                        <span style="font-family: monospace;">&lt;/&gt;</span>
                    </button>
                </div>

                <!-- Color Group -->
                <div class="toolbar-group">
                    <div class="color-picker-wrapper">
                        <button class="toolbar-btn" onclick="toggleColorPicker()" title="Text Color">
                            🎨
                        </button>
                        <div class="color-picker" id="colorPicker">
                            <div class="color-grid">
                                <div class="color-option" style="background: #000000" onclick="insertColor('#000000')"></div>
                                <div class="color-option" style="background: #333333" onclick="insertColor('#333333')"></div>
                                <div class="color-option" style="background: #666666" onclick="insertColor('#666666')"></div>
                                <div class="color-option" style="background: #999999" onclick="insertColor('#999999')"></div>
                                <div class="color-option" style="background: #cccccc" onclick="insertColor('#cccccc')"></div>
                                <div class="color-option" style="background: #ffffff" onclick="insertColor('#ffffff')"></div>
                                <div class="color-option" style="background: #ff0000" onclick="insertColor('#ff0000')"></div>
                                <div class="color-option" style="background: #00ff00" onclick="insertColor('#00ff00')"></div>
                                <div class="color-option" style="background: #0000ff" onclick="insertColor('#0000ff')"></div>
                                <div class="color-option" style="background: #ffff00" onclick="insertColor('#ffff00')"></div>
                                <div class="color-option" style="background: #ff00ff" onclick="insertColor('#ff00ff')"></div>
                                <div class="color-option" style="background: #00ffff" onclick="insertColor('#00ffff')"></div>
                                <div class="color-option" style="background: #ffa500" onclick="insertColor('#ffa500')"></div>
                                <div class="color-option" style="background: #800080" onclick="insertColor('#800080')"></div>
                                <div class="color-option" style="background: #008000" onclick="insertColor('#008000')"></div>
                                <div class="color-option" style="background: #800000" onclick="insertColor('#800000')"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- List Group -->
                <div class="toolbar-group">
                    <button class="toolbar-btn" onclick="formatText('unorderedList')" title="Bullet List">
                        • List
                    </button>
                    <button class="toolbar-btn" onclick="formatText('orderedList')" title="Number List">
                        1. List
                    </button>
                    <button class="toolbar-btn" onclick="formatText('checkList')" title="Control List">
                        ☑ List
                    </button>
                </div>

                <!-- Insert Group -->
                <div class="toolbar-group">
                    <button class="toolbar-btn" onclick="formatText('link')" title="Link">
                        🔗
                    </button>
                        <button class="toolbar-btn" onclick="formatText('image')" title="Image">
                        🖼️
                    </button>
                    <button class="toolbar-btn" onclick="formatText('table')" title="Table">
                        📊
                    </button>
                </div>

                <!-- Block Group -->
                <div class="toolbar-group">
                    <button class="toolbar-btn" onclick="formatText('quote')" title="Quote">
                        ❝
                    </button>
                    <button class="toolbar-btn" onclick="formatText('codeBlock')" title="Code Block">
                        { }
                    </button>
                    <button class="toolbar-btn" onclick="formatText('hr')" title="Horizontal Rule">
                        ―
                    </button>
                </div>

                <!-- Symbols Group -->
                <div class="toolbar-group">
                    <div class="symbol-dropdown">
                        <button class="toolbar-btn" onclick="toggleSymbolMenu()" title="Symbols">
                            ☺
                        </button>
                        <div class="symbol-menu" id="symbolMenu">
                            <div class="symbol-category">
                                <div class="symbol-category-title">Faces</div>
                                <div class="symbol-grid">
                                    <button class="symbol-btn" onclick="insertSymbol('😀')">😀</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😃')">😃</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😄')">😄</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😁')">😁</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😆')">😆</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😅')">😅</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😂')">😂</button>
                                    <button class="symbol-btn" onclick="insertSymbol('🤣')">🤣</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😊')">😊</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😇')">😇</button>
                                    <button class="symbol-btn" onclick="insertSymbol('🙂')">🙂</button>
                                    <button class="symbol-btn" onclick="insertSymbol('🙃')">🙃</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😉')">😉</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😌')">😌</button>
                                    <button class="symbol-btn" onclick="insertSymbol('😍')">😍</button>
                                    <button class="symbol-btn" onclick="insertSymbol('🥰')">🥰</button>
                                </div>
                            </div>
                            <div class="symbol-category">
                                <div class="symbol-category-title">Arrows</div>
                                <div class="symbol-grid">
                                    <button class="symbol-btn" onclick="insertSymbol('→')">→</button>
                                    <button class="symbol-btn" onclick="insertSymbol('←')">←</button>
                                    <button class="symbol-btn" onclick="insertSymbol('↑')">↑</button>
                                    <button class="symbol-btn" onclick="insertSymbol('↓')">↓</button>
                                    <button class="symbol-btn" onclick="insertSymbol('↔')">↔</button>
                                    <button class="symbol-btn" onclick="insertSymbol('↕')">↕</button>
                                    <button class="symbol-btn" onclick="insertSymbol('⇒')">⇒</button>
                                    <button class="symbol-btn" onclick="insertSymbol('⇐')">⇐</button>
                                </div>
                            </div>
                            <div class="symbol-category">
                                <div class="symbol-category-title">Symbols</div>
                                <div class="symbol-grid">
                                    <button class="symbol-btn" onclick="insertSymbol('★')">★</button>
                                    <button class="symbol-btn" onclick="insertSymbol('☆')">☆</button>
                                    <button class="symbol-btn" onclick="insertSymbol('♦')">♦</button>
                                    <button class="symbol-btn" onclick="insertSymbol('♥')">♥</button>
                                    <button class="symbol-btn" onclick="insertSymbol('♠')">♠</button>
                                    <button class="symbol-btn" onclick="insertSymbol('♣')">♣</button>
                                    <button class="symbol-btn" onclick="insertSymbol('✓')">✓</button>
                                    <button class="symbol-btn" onclick="insertSymbol('✗')">✗</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <textarea class="editor" id="editor" placeholder="Start writing your markdown...">${file.content}</textarea>
        `;

        const editorEl = document.getElementById('editor');
        if (editorEl) {
            editorEl.addEventListener('input', (e) => {
                this.updateFileContent(e.target.value);
                // Update solution explorer when content changes
                updateSolutionExplorer(e.target.value);
            });

            editorEl.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveFile();
                }
                // Add keyboard shortcuts for formatting
                if (e.ctrlKey && e.key === 'b') {
                    e.preventDefault();
                    formatText('bold');
                }
                if (e.ctrlKey && e.key === 'i') {
                    e.preventDefault();
                    formatText('italic');
                }
                // Theme switching shortcut
                if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                    e.preventDefault();
                    toggleTheme();
                }
            });

            editorEl.focus();
            
            // Update solution explorer with current file content
            updateSolutionExplorer(file.content);
        }
    }

    showEmptyState() {
        this.editorContainer.innerHTML = `
            <div class="empty-state" id="emptyState">
                <div class="icon">📝</div>
                <div>Start by creating a new markdown file</div>
                <div class="welcome-actions">
                    <button class="btn" onclick="newFile()">New File</button>
                    <button class="btn btn-secondary" onclick="createSample()">Sample Document</button>
                </div>
            </div>
        `;
        
        this.preview.innerHTML = `
            <div class="empty-state">
                <div class="icon">👁</div>
                <div>Preview will appear here</div>
            </div>
        `;
        
        // Clear solution explorer when showing empty state
        showEmptyExplorer();
    }

    updatePreview() {
        if (!this.activeFile) return;

        const content = this.files[this.activeFile].content;
        if (content.trim()) {
            // First, render markdown without mermaid processing
            let html = marked.parse(content);
            
            // Process internal file links [[filename]] syntax
            html = this.processInternalLinks(html);
            
            // Set the HTML first
            this.preview.innerHTML = html;
            
            // Then process mermaid diagrams after DOM is ready
            if (typeof mermaid !== 'undefined') {
                setTimeout(() => {
                    // Find all mermaid code blocks
                    const mermaidBlocks = this.preview.querySelectorAll('code.language-mermaid');
                    
                    mermaidBlocks.forEach((block, index) => {
                        const mermaidCode = block.textContent.trim();
                        const diagramId = `mermaid-diagram-${Date.now()}-${index}`;
                        
                        // Create a new div to replace the code block
                        const mermaidContainer = document.createElement('div');
                        mermaidContainer.className = 'mermaid-container';
                        mermaidContainer.id = diagramId;
                        
                        // Replace the pre > code block with our container
                        const preElement = block.parentElement;
                        preElement.parentElement.replaceChild(mermaidContainer, preElement);
                        
                        // Render the mermaid diagram
                        try {
                            mermaid.render(`${diagramId}-svg`, mermaidCode).then(result => {
                                mermaidContainer.innerHTML = result.svg;
                                mermaidContainer.classList.add('mermaid');
                    }).catch(e => {
                                console.error('Mermaid render error:', e);
                                mermaidContainer.innerHTML = `
                                    <div style="color: #e74c3c; padding: 16px; background: #2d2d30; border-radius: 4px; margin: 16px 0;">
                                        <strong>⚠️ Mermaid Diagram Error:</strong><br/>
                                        ${e.message || 'Failed to render diagram'}
                                        <details style="margin-top: 8px;">
                                            <summary style="cursor: pointer;">View diagram code</summary>
                                            <pre style="background: #1e1e1e; padding: 8px; margin-top: 8px; border-radius: 2px; font-size: 12px;">${mermaidCode}</pre>
                                        </details>
                                    </div>
                                `;
                            });
                        } catch (e) {
                            console.error('Mermaid setup error:', e);
                            mermaidContainer.innerHTML = `
                                <div style="color: #e74c3c; padding: 16px; background: #2d2d30; border-radius: 4px; margin: 16px 0;">
                                    <strong>⚠️ Mermaid Setup Error</strong><br/>
                                    Could not initialize diagram renderer.
                                </div>
                            `;
                        }
                    });
                }, 100);
            }
        } else {
            this.preview.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👁</div>
                    <div>Start typing to see preview</div>
                </div>
            `;
        }
    }

    processInternalLinks(html) {
        // Process [[filename]] syntax for internal file links
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        
        return html.replace(linkRegex, (match, fileName) => {
            // Find the file by name
            const fileEntry = Object.entries(this.files).find(([id, file]) => {
                return file.name.toLowerCase() === fileName.toLowerCase() || 
                       file.name.toLowerCase() === fileName.toLowerCase() + '.md' ||
                       file.name.toLowerCase().replace('.md', '') === fileName.toLowerCase();
            });
            
            if (fileEntry) {
                const [fileId, file] = fileEntry;
                return `<a href="#" onclick="editor.openFile('${fileId}'); return false;" style="color: #007acc; text-decoration: none; border-bottom: 1px dotted #007acc;" title="Open ${file.name}">📄 ${fileName}</a>`;
            } else {
                // File not found - show as a broken link with option to create
                return `<span style="color: #e74c3c; text-decoration: line-through;" title="File not found">📄 ${fileName}</span> <a href="#" onclick="editor.createFileFromLink('${fileName}'); return false;" style="color: #28a745; font-size: 12px;" title="Create this file">[Create]</a>`;
            }
        });
    }

    createFileFromLink(fileName) {
        // Ensure the filename has .md extension
        const fullFileName = fileName.endsWith('.md') ? fileName : fileName + '.md';
        
        // Create the file
        const fileId = this.createFile(fullFileName, `# ${fileName}\n\nThis file was created from a link.\n`);
        
        // Open the newly created file
        this.openFile(fileId);
    }

    updateStatus() {
        const statusLeft = document.getElementById('statusLeft');
        const statusRight = document.getElementById('statusRight');
        
        if (this.activeFile) {
            const file = this.files[this.activeFile];
            statusLeft.textContent = `${file.name}${file.modified ? ' • unsaved' : ' • saved'}`;
            statusRight.textContent = `${file.content.length} chars`;
        } else {
            statusLeft.textContent = 'Ready';
            statusRight.textContent = 'Markdown';
        }
    }

    saveFile() {
        if (!this.activeFile) return;
        
        const file = this.files[this.activeFile];
        
        // Mark as saved in memory
        file.modified = false;
        this.saveToStorage();
        this.renderTabs();
        this.renderFileTree();
        this.updateStatus();
        
        // Download the file to user's computer
        const blob = new Blob([file.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show save confirmation
        const statusLeft = document.getElementById('statusLeft');
        statusLeft.textContent = `File "${file.name}" saved to Downloads!`;
        setTimeout(() => {
            this.updateStatus();
        }, 2000);
    }

    autoSave() {
        // Auto-save to localStorage only (no download)
        if (!this.activeFile) return;
        
        this.saveToStorage();
        
        // Update status briefly
        const statusLeft = document.getElementById('statusLeft');
        const originalText = statusLeft.textContent;
        statusLeft.textContent = 'Auto-saved';
        setTimeout(() => {
            this.updateStatus();
        }, 1000);
    }

    setupEventListeners() {
        // Modal event listeners
        ['newFileModal', 'newFolderModal', 'exportModal', 'importModal', 'diagramModal', 'linkModal', 'renameModal'].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modalId);
                    }
                });
            }
        });

        // Add Enter key handlers for inputs
        document.getElementById('newFileName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createNewFile();
            }
        });

        document.getElementById('newFolderName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createNewFolderConfirm();
            }
        });

        document.getElementById('newItemName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmRename();
            }
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        this.newFile();
                        break;
                    case 'N':
                        if(e.shiftKey) {
                            e.preventDefault();
                            // New folder shortcut
                            document.getElementById('newFolderModal').style.display = 'block';
                            document.getElementById('newFolderName').focus();
                            this.populateParentFolderSelectForFolder();
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        if(e.shiftKey) {
                            // Toggle split view
                            this.splitViewVertical();
                        } else {
                            this.saveFile();
                        }
                        break;
                    case 'e':
                        e.preventDefault();
                        this.showExportModal();
                        break;
                    case 'd':
                        e.preventDefault();
                        showDiagramEditor();
                        break;
                    case 'l':
                        e.preventDefault();
                        showLinkModal();
                        break;
                }
            }
        });

        // File upload event listeners
        const fileUploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        
        if (fileUploadArea && fileInput) {
            fileUploadArea.addEventListener('click', () => fileInput.click());
            fileUploadArea.addEventListener('dragover', handleDragOver);
            fileUploadArea.addEventListener('dragleave', handleDragLeave);
            fileUploadArea.addEventListener('drop', handleFileDrop);
            fileInput.addEventListener('change', handleFileSelect);
        }
    }

    setupResizer() {
        console.log('🔧 Setting up column resizer...');
        
        const resizer = document.getElementById('resizer');
        const editorPanes = document.querySelector('.editor-panes');
        const leftPane = editorPanes?.querySelector('.editor-pane:first-child');
        const rightPane = editorPanes?.querySelector('.editor-pane:last-child');
        
        console.log('Resizer elements found:', {
            resizer: !!resizer,
            editorPanes: !!editorPanes,
            leftPane: !!leftPane,
            rightPane: !!rightPane
        });
        
        if (!resizer || !editorPanes || !leftPane || !rightPane) {
            console.error('❌ Missing resizer elements - column resizing disabled');
            return;
        }
        
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            console.log('🖱️ Resizer mousedown event');
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            
            const editorPanesRect = editorPanes.getBoundingClientRect();
            const leftPaneRect = leftPane.getBoundingClientRect();
            const rightPaneRect = rightPane.getBoundingClientRect();
            
            startLeftWidth = leftPaneRect.width;
            startRightWidth = rightPaneRect.width;
            
            // Add visual feedback
            document.body.classList.add('resizing');
            resizer.classList.add('resizing');
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            e.preventDefault();
            
            const deltaX = e.clientX - startX;
            const editorPanesRect = editorPanes.getBoundingClientRect();
            const totalWidth = editorPanesRect.width - 6; // Subtract resizer width
            
            const newLeftWidth = Math.max(200, Math.min(totalWidth - 200, startLeftWidth + deltaX));
            const newRightWidth = totalWidth - newLeftWidth;
            
            const leftPercentage = (newLeftWidth / totalWidth) * 100;
            const rightPercentage = (newRightWidth / totalWidth) * 100;
            
            leftPane.style.flex = `0 0 ${leftPercentage}%`;
            rightPane.style.flex = `0 0 ${rightPercentage}%`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                console.log('🖱️ Resizer mouseup event');
                isResizing = false;
                document.body.classList.remove('resizing');
                resizer.classList.remove('resizing');
            }
        });
        
        // Handle mouse leave to stop resizing
        document.addEventListener('mouseleave', () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('resizing');
                resizer.classList.remove('resizing');
            }
        });
        
        console.log('✅ Column resizer setup completed');
    }

    populateParentFolderSelect() {
        const select = document.getElementById('parentFolderSelect');
        if (!select) {
            console.error('Parent folder select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">Root Directory</option>';
        
        // Create a recursive function to build folder hierarchy
        const addFolderOptions = (parentId, prefix = '') => {
            Object.entries(this.folders)
                .filter(([id, folder]) => folder.parent === parentId)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name))
                .forEach(([id, folder]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = prefix + folder.name;
                    select.appendChild(option);
                    
                    // Recursively add subfolders with increased indentation
                    addFolderOptions(id, prefix + '  ');
                });
        };
        
        addFolderOptions(null);
        
        // Debug info
        console.log('Available folders:', Object.keys(this.folders).length);
        console.log('Select options:', select.children.length);
    }

    newFile() {
        document.getElementById('newFileModal').style.display = 'block';
        document.getElementById('newFileName').focus();
        document.getElementById('newFileName').value = `untitled-${Date.now()}.md`;
        this.populateParentFolderSelect();
    }

    createNewFile() {
        const name = document.getElementById('newFileName').value.trim();
        const parentFolderId = document.getElementById('parentFolderSelect').value;
        
        if (!name) {
            alert('Please enter a filename.');
            return;
        }
        
        try {
            let fileId;
            if (parentFolderId && parentFolderId !== '') {
                // Check if the parent folder still exists
                if (!this.folders[parentFolderId]) {
                    alert('Selected parent folder no longer exists. Please select another folder or use root directory.');
                    this.populateParentFolderSelect(); // Refresh the dropdown
                    return;
                }
                fileId = this.createFile(name, '', parentFolderId);
            } else {
                // Create in root directory
                fileId = this.createFile(name, '', null);
            }
            
            this.closeModal('newFileModal');
            
            // Show success message
            const statusLeft = document.getElementById('statusLeft');
            statusLeft.textContent = `Created: ${name}`;
            setTimeout(() => {
                this.updateStatus();
            }, 2000);
            
        } catch (error) {
            console.error('File creation error:', error);
            alert('Failed to create file: ' + error.message);
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showExportModal() {
        console.log('📤 ShowExportModal called (class method)');
        if (!this.activeFile) {
            alert('Please select a file to export first.');
            return;
        }
        
        console.log('📤 Opening export modal for file:', this.files[this.activeFile].name);
        document.getElementById('exportModal').style.display = 'block';
    }

    performExport() {
        console.log('📤 PerformExport called (class method)');
        if (!this.activeFile) {
            alert('Please select a file to export.');
            return;
        }
        
        const format = document.getElementById('exportFormat').value;
        const file = this.files[this.activeFile];
        
        console.log('📤 Exporting file:', file.name, 'as format:', format);
        
        switch (format) {
            case 'md':
                this.exportAsMarkdown(file);
                break;
            case 'txt':
                this.exportAsText(file);
                break;
            case 'pdf':
                this.exportAsPDF(file);
                break;
            case 'html':
                this.exportAsHTML(file);
                break;
        }
        
        console.log('📤 Closing export modal');
        this.closeModal('exportModal');
    }

    exportAsMarkdown(file) {
        console.log('📄 ExportAsMarkdown called for:', file.name);
        const blob = new Blob([file.content], { type: 'text/markdown' });
        this.downloadFile(blob, file.name.replace(/\.[^/.]+$/, '') + '.md');
        console.log('📄 Markdown export completed');
    }

    exportAsText(file) {
        console.log('📝 ExportAsText called for:', file.name);
        const blob = new Blob([file.content], { type: 'text/plain' });
        this.downloadFile(blob, file.name.replace(/\.[^/.]+$/, '') + '.txt');
        console.log('📝 Text export completed');
    }

    exportAsHTML(file) {
        console.log('🌐 ExportAsHTML called for:', file.name);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${file.name}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 12px; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f4f4f4; }
</style>
</head>
<body>
${marked.parse(file.content)}
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'text/html' });
        this.downloadFile(blob, file.name.replace(/\.[^/.]+$/, '') + '.html');
        console.log('🌐 HTML export completed');
    }

    downloadFile(blob, filename) {
        console.log('💾 DownloadFile called with:', { 
            blobSize: blob?.size, 
            blobType: blob?.type, 
            filename: filename 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Download completed for:', filename);
    }

    exportAsPDF(file) {
        if (typeof window.jsPDF === 'undefined') {
            // Fallback: create printable HTML version
            this.exportAsPrintablePDF(file);
            return;
        }

        try {
            const { jsPDF } = window.jsPDF;
            const doc = new jsPDF();
            
            // Convert markdown to clean text for PDF
            const htmlContent = marked.parse(file.content);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            // Remove HTML tags and get clean text
            const cleanText = tempDiv.textContent || tempDiv.innerText || '';
            
            // Split text into lines that fit the PDF width
            const lines = doc.splitTextToSize(cleanText, 180);
            
            // Add title
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(file.name, 15, 20);
            
            // Add content
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            
            let yPosition = 35;
            for (let i = 0; i < lines.length; i++) {
                if (yPosition > 280) { // Check if we need a new page
                    doc.addPage();
                    yPosition = 20;
                }
                doc.text(lines[i], 15, yPosition);
                yPosition += 6;
            }
            
            doc.save(file.name.replace(/\.[^/.]+$/, '') + '.pdf');
        } catch (error) {
            console.error('PDF export error:', error);
            alert('PDF export failed. Trying alternative method...');
            this.exportAsPrintablePDF(file);
        }
    }

    exportAsPrintablePDF(file) {
        // Create a printable HTML version that user can save as PDF
        const htmlContent = marked.parse(file.content);
        const printableHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${file.name} - Print Version</title>
<style>
@media print {
    body { margin: 0; }
    .no-print { display: none; }
}
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.6;
    color: #333;
}
h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; }
h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 8px; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
code {
    background: #f6f8fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.45;
}
pre code { background: none; padding: 0; }
blockquote {
    border-left: 4px solid #dfe2e5;
    margin: 0;
    padding-left: 16px;
    color: #6a737d;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
}
th, td {
    border: 1px solid #dfe2e5;
    padding: 8px 12px;
    text-align: left;
}
th { background: #f6f8fa; font-weight: 600; }
.print-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #eee;
}
.print-instructions {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
    text-align: center;
}
</style>
</head>
<body>
<div class="print-instructions no-print">
<strong>📄 Ready to Print/Save as PDF</strong><br>
Use Ctrl+P (Windows) or Cmd+P (Mac) to print or save as PDF
</div>
<div class="print-header">
<h1>${file.name}</h1>
<small>Generated on ${new Date().toLocaleDateString()}</small>
</div>
<div class="content">
${htmlContent}
</div>
</body>
</html>`;

        const blob = new Blob([printableHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
        } else {
            // Fallback: download the HTML file
            this.downloadFile(blob, file.name.replace(/\.[^/.]+$/, '') + '_printable.html');
            alert('Print popup blocked. HTML file downloaded instead. Open it and use Ctrl+P to print as PDF.');
        }
    }

    /*
    downloadFile(fileId) {
        const file = this.files[fileId];
        if (!file) return;
        
        const blob = new Blob([file.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show download confirmation
        const statusLeft = document.getElementById('statusLeft');
        statusLeft.textContent = `Downloaded: ${file.name}`;
        setTimeout(() => {
            this.updateStatus();
        }, 2000);
    }*/

    async downloadFolderAsZip(folderId) {
        if (typeof JSZip === 'undefined') {
            alert('ZIP functionality not available. Please try individual file downloads.');
            return;
        }
        
        const folder = this.folders[folderId];
        if (!folder) return;
        
        const zip = new JSZip();
        const folderName = folder.name.replace(/[^a-z0-9]/gi, '_');
        
        // Add all files and subfolders recursively
        await this.addFolderToZip(zip, folderId, '');
        
        try {
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${folderName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show download confirmation
            const statusLeft = document.getElementById('statusLeft');
            statusLeft.textContent = `Downloaded: ${folderName}.zip`;
            setTimeout(() => {
                this.updateStatus();
            }, 2000);
        } catch (error) {
            console.error('Error creating ZIP:', error);
            alert('Error creating ZIP file. Please try again.');
        }
    }

    async addFolderToZip(zip, folderId, basePath) {
        const folder = this.folders[folderId];
        if (!folder) return;
        
        const currentPath = basePath ? `${basePath}/${folder.name}` : folder.name;
        
        // Add all files in this folder
        Object.entries(this.files)
            .filter(([id, file]) => file.parent === folderId)
            .forEach(([id, file]) => {
                const filePath = `${currentPath}/${file.name}`;
                zip.file(filePath, file.content);
            });
        
        // Recursively add subfolders
        const subfolders = Object.entries(this.folders)
            .filter(([id, subfolder]) => subfolder.parent === folderId);
        
        for (const [subId, subfolder] of subfolders) {
            await this.addFolderToZip(zip, subId, currentPath);
        }
    }

    async downloadAllAsZip() {
        if (typeof JSZip === 'undefined') {
            alert('ZIP functionality not available.');
            return;
        }
        
        const zip = new JSZip();
        
        // Add all root-level files
        Object.entries(this.files)
            .filter(([id, file]) => !file.parent)
            .forEach(([id, file]) => {
                zip.file(file.name, file.content);
            });
        
        // Add all root-level folders recursively
        const rootFolders = Object.entries(this.folders)
            .filter(([id, folder]) => !folder.parent);
        
        for (const [folderId, folder] of rootFolders) {
            await this.addFolderToZip(zip, folderId, '');
        }
        
        try {
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `markdown_project_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show download confirmation
            const statusLeft = document.getElementById('statusLeft');
            statusLeft.textContent = 'Downloaded: Complete project as ZIP';
            setTimeout(() => {
                this.updateStatus();
            }, 2000);
        } catch (error) {
            console.error('Error creating project ZIP:', error);
            alert('Error creating project ZIP file. Please try again.');
        }
    }

    togglePreview() {
        if (this.splitMode) {
            // In split mode, toggle preview for all splits
            this.splitViews.forEach(split => {
                split.previewVisible = !split.previewVisible;
                const previewContainer = document.querySelector(`#${split.id} .split-preview-container`);
                if (previewContainer) {
                    previewContainer.style.display = split.previewVisible ? 'flex' : 'none';
                }
            });
        } else {
            // Normal mode
        const previewPane = document.getElementById('previewPane');
        const resizer = document.getElementById('resizer');
        
        if (this.previewVisible) {
            previewPane.style.display = 'none';
            resizer.style.display = 'none';
            this.previewVisible = false;
        } else {
            previewPane.style.display = 'flex';
            resizer.style.display = 'block';
            this.previewVisible = true;
            }
        }
    }

    exportFile() {
        if (!this.activeFile) return;
        
        const file = this.files[this.activeFile];
        const blob = new Blob([file.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    createSample() {
        // Create a main sample folder
        const mainFolderId = this.createFolder('Sample Documents');
        
        // Create a subfolder for tutorials
        const tutorialsFolderId = this.createFolder('Tutorials', mainFolderId);
        
        // Create another subfolder for examples
        const examplesFolderId = this.createFolder('Examples', tutorialsFolderId);
        
        // Create the main getting started document
        const mainContent = `# Welcome to Advanced Markdown Editor

This is an **enhanced markdown editor** with powerful features!

## Current Features

- Live preview with real-time rendering
- Tree-structured file management (like Obsidian!)
- Hierarchical folder organization (now working properly!)
- File upload via drag and drop
- Internal file linking with [[filename]] syntax
- Interactive diagram editor (JSON to flowchart)
- Mermaid diagram support with proper rendering
- Multiple export formats (MD, TXT, PDF, HTML) - ALL WORKING!
- Split view functionality for side-by-side editing
- Multiple file tabs with persistent sessions

## 📁 File Organization Features

### Create Files Under Folders
- Use the **+** button in the sidebar
- Select parent folder from dropdown
- Files are properly organized in hierarchy

### Create Nested Folders
- Use the **folder+** button in the sidebar
- Select parent folder to create subfolders
- Unlimited nesting depth supported

### Tree View Toggle
- Click **tree** button for Windows tree style view
- ASCII tree structure with proper indentation
- Perfect for understanding folder relationships

## 📤 Export System

All export formats now work correctly:

1. **Markdown (.md)** - Original format preserved
2. **Text (.txt)** - Plain text version
3. **HTML (.html)** - Web-ready with styling
4. **PDF (.pdf)** - Print-ready document

## Split View

- Click **Split** button to work on multiple files
- Right-click any file → **Open in Split**
- Each split has independent editor + preview
- Toggle preview affects all splits

## 🎯 Getting Started

1. **Organize Your Work:**
- Create folders: **folder+** button
- Create files in folders: **+** button then select parent folder

2. **Multi-File Workflow:**
- Open multiple files (they stay in tabs)
- Use split view for side-by-side comparison
- Link files together with [[filename]] syntax

3. **Export When Ready:**
- **Ctrl+E** or **Export** button
- Choose your preferred format
- All formats work reliably

---

**Next Steps**: Check out [[Tutorial - Basic Usage]] and [[Advanced Features]]!

**Pro Tips**: 
- Right-click files for context menu options
- Use **tree** button to see folder structure clearly
- Split view is great for comparing documents`;

        // Create tutorial content
        const tutorialContent = `# Tutorial - Basic Usage

## File Organization That Works!

This file is located in: **Sample Documents > Tutorials**

The new folder system now works perfectly:

### Creating Files in Folders
1. Click **+** (New File) button
2. Enter filename
3. **Select parent folder** from dropdown
4. Click Create

### Creating Nested Folders
1. Click **folder+** (New Folder) button  
2. Enter folder name
3. **Select parent folder** for nesting
4. Click Create

### Tree View Navigation
- Click **tree** button to see ASCII tree structure
- Perfect Windows-style folder tree display
- Shows exact hierarchical relationships

## Export Features

All export formats now work:
- **MD**: [[Advanced Features]] - Try clicking this link!
- **TXT**: Plain text version
- **HTML**: Styled web page
- **PDF**: Print-ready document

## Split View Usage

1. Open this file
2. Click **Split** button
3. Right-click another file then **Open in Split**
4. Edit both files simultaneously!

---

Return to: [[Getting Started]] | Continue to: [[Advanced Features]]`;

        // Create advanced features content
        const advancedContent = `# Advanced Features

## Multi-Document Editing

### Split View System
- **Split** button creates side-by-side editors
- Each split has independent preview
- **Preview** toggles all split previews
- Perfect for documentation workflows

### Tab Management
- Multiple files stay open in tabs
- Persistent across browser sessions
- **Close** buttons on each tab
- Right-click for context menu

## Professional Export System

### HTML Export Features
- GitHub-style CSS styling
- Proper heading hierarchy
- Code syntax highlighting preparation
- Responsive design ready

### PDF Export Options
- Clean text-based PDF generation
- Fallback printable HTML method
- Automatic page breaks
- Professional formatting

## File Management

### Context Menu Options
- **Open** - Standard file opening
- **Open in New Tab** - Force new tab
- **Open in Split** - Split view activation
- **Copy Name** - Clipboard copy
- **Delete** - Safe deletion with confirmation

### Tree Structure Benefits
\`\`\`
Sample Documents/
|-- Getting Started.md
+-- Tutorials/
|-- Tutorial - Basic Usage.md
|-- Advanced Features.md
+-- Examples/
+-- Quick Reference.md
\`\`\`

## Keyboard Shortcuts

- **Ctrl+N**: New file
- **Ctrl+Shift+N**: New folder
- **Ctrl+S**: Save current file
- **Ctrl+E**: Export current file
- **Ctrl+D**: Open diagram editor
- **Ctrl+L**: Insert link
- **Ctrl+Shift+S**: Toggle split view

---

Navigation: [[Getting Started]] | [[Tutorial - Basic Usage]] | [[Quick Reference]]`;

        // Create a quick reference in the nested folder
        const quickRefContent = `# Quick Reference

Located in: Sample Documents > Tutorials > Examples

## File Operations
- New File: + button, select folder, create
- New Folder: folder+ button, select parent, create  
- Upload Files: Drag and drop or upload button
- Tree View: tree button for ASCII structure

## Export Formats
- MD: Original markdown
- TXT: Plain text  
- HTML: Styled webpage
- PDF: Print document

## Split View
- Split: Toggle split mode
- Right-click to Open in Split
- Independent editor + preview pairs

## Internal Links
- Use [[filename]] syntax
- Click links to navigate
- Auto-create missing files

---

This demonstrates nested folder creation working perfectly!

Back to: [[Advanced Features]]`;

        // Create the files in the proper hierarchy
        this.createFile('Getting Started.md', mainContent, mainFolderId);
        this.createFile('Tutorial - Basic Usage.md', tutorialContent, tutorialsFolderId);
        this.createFile('Advanced Features.md', advancedContent, tutorialsFolderId);
        this.createFile('Quick Reference.md', quickRefContent, examplesFolderId);
    }

    deleteFile(fileId) {
        if (!this.files[fileId]) return;
        
        const file = this.files[fileId];
        if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
            // Remove from open files if it's open
            this.openFiles = this.openFiles.filter(id => id !== fileId);
            
            // If this is the active file, switch to another open file or show empty state
            if (this.activeFile === fileId) {
                if (this.openFiles.length > 0) {
                    this.openFile(this.openFiles[this.openFiles.length - 1], false);
                } else {
                    this.activeFile = null;
                    this.renderTabs();
                    this.showEmptyState();
                }
            }
            
            // Delete the file
            delete this.files[fileId];
            
            this.saveToStorage();
            this.renderFileTree();
            this.renderTabs();
        }
    }

    deleteFolder(folderId) {
        if (!this.folders[folderId]) return;
        
        const folder = this.folders[folderId];
        
        // Check if folder has children
        const hasChildren = Object.values(this.folders).some(f => f.parent === folderId) ||
                           Object.values(this.files).some(f => f.parent === folderId);
        
        if (hasChildren) {
            if (!confirm(`Folder "${folder.name}" contains files or subfolders. Delete everything inside?`)) {
                return;
            }
            
            // Delete all children recursively
            this.deleteFolderRecursive(folderId);
        } else {
            if (!confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
                return;
            }
            
            delete this.folders[folderId];
        }
        
        this.saveToStorage();
        this.renderFileTree();
    }

    deleteFolderRecursive(folderId) {
        // Delete all files in this folder
        Object.entries(this.files)
            .filter(([id, file]) => file.parent === folderId)
            .forEach(([id]) => {
                if (this.activeFile === id) {
                    this.activeFile = null;
                    this.renderTabs();
                    this.showEmptyState();
                }
                delete this.files[id];
            });
        
        // Delete all subfolders recursively
        Object.entries(this.folders)
            .filter(([id, folder]) => folder.parent === folderId)
            .forEach(([id]) => {
                this.deleteFolderRecursive(id);
            });
        
        // Delete the folder itself
        delete this.folders[folderId];
    }

    openFolder(folderId) {
        const folder = this.folders[folderId];
        if (!folder) return;
        
        folder.expanded = !folder.expanded;
        this.saveToStorage();
        this.renderFileTree();
    }

    /*
    toggleTreeView() {
        this.treeView = !this.treeView;
        this.renderFileTree();
        
        // Update button appearance
        const treeViewBtn = document.getElementById('treeViewBtn');
        if (this.treeView) {
            treeViewBtn.style.background = '#007acc';
            treeViewBtn.title = 'Switch to Normal View';
        } else {
            treeViewBtn.style.background = '';
            treeViewBtn.title = 'Toggle Tree View';
        }
    }*/

    showFileContextMenu(event, fileId) {
        console.log('🔍 ShowFileContextMenu called for fileId:', fileId);
        event.preventDefault();
        
        // Remove any existing context menu
        const existingMenu = document.getElementById('contextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const file = this.files[fileId];
        if (!file) {
            console.error('❌ File not found:', fileId);
            return;
        }
        
        console.log('📁 Creating context menu for file:', file.name);
        
        const contextMenu = document.createElement('div');
        contextMenu.id = 'contextMenu';
        contextMenu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #2d2d30;
            border: 1px solid #464647;
            border-radius: 4px;
            min-width: 160px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        
        const menuItems = [
            {
                text: '📄 Open',
                action: () => {
                    console.log('📄 Open action called for:', fileId);
                    this.openFile(fileId);
                }
            },
            {
                text: '📑 Open in New Tab',
                action: () => {
                    console.log('📑 Open in New Tab action called for:', fileId);
                    this.openFile(fileId);
                    // Force add to open files even if already open
                    if (!this.openFiles.includes(fileId)) {
                        this.openFiles.push(fileId);
                        this.renderTabs();
                    }
                }
            },
            {
                text: '⬌ Open in Split',
                action: () => {
                    console.log('⬌ Open in Split action called for:', fileId);
                    // Open the file first
                    this.openFile(fileId);
                    
                    // Then activate split view
                    setTimeout(() => {
                        splitViewVertical();
                    }, 100);
                }
            },
            {
                text: '📋 Copy Name',
                action: () => {
                    console.log('📋 Copy Name action called for:', fileId);
                    const file = this.files[fileId];
                    if (file) {
                        navigator.clipboard.writeText(file.name).then(() => {
                            const statusLeft = document.getElementById('statusLeft');
                            const originalText = statusLeft.textContent;
                            statusLeft.textContent = 'Filename copied to clipboard';
                            setTimeout(() => {
                                this.updateStatus();
                            }, 1500);
                        });
                    }
                }
            },
            {
                text: '✏️ Rename',
                action: () => {
                    console.log('✏️ Rename action called for:', fileId);
                    this.showRenameModal(fileId, 'file');
                }
            },
            {
                text: '🗑️ Delete',
                action: () => {
                    console.log('🗑️ Delete action called for:', fileId);
                    this.deleteFile(fileId);
                }
            }
        ];
        
        console.log('📝 Menu items created:', menuItems.length, 'items');
        console.log('📝 Menu items:', menuItems.map(item => item.text));
        
        menuItems.forEach((menuItem, index) => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                font-size: 13px;
                color: #cccccc;
                transition: background 0.2s;
            `;
            item.textContent = menuItem.text;
            item.onmouseover = () => item.style.background = '#37373d';
            item.onmouseout = () => item.style.background = '';
            item.onclick = () => {
                console.log('🖱️ Menu item clicked:', menuItem.text);
                menuItem.action();
                contextMenu.remove();
            };
            
            if (index === menuItems.length - 1) {
                item.style.borderTop = '1px solid #464647';
                item.style.color = '#e74c3c';
            }
            
            contextMenu.appendChild(item);
        });
        
        document.body.appendChild(contextMenu);
        console.log('✅ Context menu added to DOM with', contextMenu.children.length, 'items');
        
        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                console.log('🚪 Closing context menu');
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    openInSplitView(fileId) {
        if (!this.files[fileId]) return;
        
        if (this.splitMode) {
            // Create a new split with this file
            this.createSplitView(fileId);
        } else {
            // Start split mode with current and new file
            const currentFile = this.activeFile;
            this.splitViews = [];
            this.createSplitView(currentFile);
            this.createSplitView(fileId);
        }
    }

    createSplitView(fileId = null) {
        const splitId = 'split_' + Date.now();
        const split = {
            id: splitId,
            fileId: fileId || this.activeFile,
            previewVisible: true
        };
        
        this.splitViews.push(split);
        this.splitMode = true;
        this.renderSplitView();
        return splitId;
    }

    renderSplitView() {
        const editorPanes = document.querySelector('.editor-panes');
        editorPanes.className = 'editor-panes split-mode';
        editorPanes.innerHTML = '';

        // Create split container
        const splitContainer = document.createElement('div');
        splitContainer.className = 'split-container';

        if (this.splitViews.length === 0) {
            // No splits, revert to normal view
            this.splitMode = false;
            editorPanes.className = 'editor-panes';
            this.renderNormalView();
            return;
        }

        this.splitViews.forEach((split, index) => {
            const splitPane = this.createSplitPane(split, index);
            splitContainer.appendChild(splitPane);
        });

        editorPanes.appendChild(splitContainer);
        
        // Update content for each split
        this.splitViews.forEach(split => {
            this.updateSplitContent(split);
        });
    }

    createSplitPane(split, index) {
        const splitPane = document.createElement('div');
        splitPane.className = 'split-pane';
        splitPane.id = split.id;

        // Add close button for splits (except the first one)
        if (index > 0) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'split-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.title = 'Close split';
            closeBtn.onclick = () => this.closeSplit(split.id);
            splitPane.appendChild(closeBtn);
        }

        const editorPreview = document.createElement('div');
        editorPreview.className = 'split-editor-preview';

        // Editor container
        const editorContainer = document.createElement('div');
        editorContainer.className = 'split-editor-container';
        
        const editorHeader = document.createElement('div');
        editorHeader.className = 'pane-header';
        editorHeader.innerHTML = '📝 Editor';
        
        const editorDiv = document.createElement('div');
        editorDiv.id = `editor-${split.id}`;
        editorDiv.style.flex = '1';
        
        editorContainer.appendChild(editorHeader);
        editorContainer.appendChild(editorDiv);

        // Preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'split-preview-container';
        previewContainer.style.display = split.previewVisible ? 'flex' : 'none';
        
        const previewHeader = document.createElement('div');
        previewHeader.className = 'pane-header';
        previewHeader.innerHTML = '👁 Preview';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'preview';
        previewDiv.id = `preview-${split.id}`;
        previewDiv.style.flex = '1';
        
        previewContainer.appendChild(previewHeader);
        previewContainer.appendChild(previewDiv);

        editorPreview.appendChild(editorContainer);
        editorPreview.appendChild(previewContainer);
        splitPane.appendChild(editorPreview);

        return splitPane;
    }

    updateSplitContent(split) {
        const editorEl = document.getElementById(`editor-${split.id}`);
        const previewEl = document.getElementById(`preview-${split.id}`);
        
        if (!editorEl || !previewEl) return;

        if (split.fileId && this.files[split.fileId]) {
            const file = this.files[split.fileId];
            
            // Create editor textarea
            editorEl.innerHTML = `
                <textarea class="editor" placeholder="Start writing your markdown here...">${file.content}</textarea>
            `;

            const textarea = editorEl.querySelector('textarea');
            textarea.addEventListener('input', (e) => {
                this.updateFileContent(e.target.value, split.fileId);
                this.updateSplitPreview(split);
            });

            textarea.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveFile();
                }
            });

            // Update preview
            this.updateSplitPreview(split);
        } else {
            editorEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📝</div>
                    <div>Select a file to edit</div>
                </div>
            `;
            previewEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👁</div>
                    <div>Preview will appear here</div>
                </div>
            `;
        }
    }

    updateSplitPreview(split) {
        const previewEl = document.getElementById(`preview-${split.id}`);
        if (!previewEl || !split.fileId || !this.files[split.fileId]) return;

        const content = this.files[split.fileId].content;
        if (content.trim()) {
            let html = marked.parse(content);
            html = this.processInternalLinks(html);
            previewEl.innerHTML = html;

            // Process mermaid diagrams
            if (typeof mermaid !== 'undefined') {
                setTimeout(() => {
                    const mermaidBlocks = previewEl.querySelectorAll('code.language-mermaid');
                    mermaidBlocks.forEach((block, index) => {
                        const mermaidCode = block.textContent.trim();
                        const diagramId = `mermaid-${split.id}-${Date.now()}-${index}`;
                        
                        const mermaidContainer = document.createElement('div');
                        mermaidContainer.className = 'mermaid-container';
                        mermaidContainer.id = diagramId;
                        
                        const preElement = block.parentElement;
                        preElement.parentElement.replaceChild(mermaidContainer, preElement);
                        
                        try {
                            mermaid.render(`${diagramId}-svg`, mermaidCode).then(result => {
                                mermaidContainer.innerHTML = result.svg;
                                mermaidContainer.classList.add('mermaid');
                            }).catch(e => {
                                console.error('Mermaid render error:', e);
                                mermaidContainer.innerHTML = `
                                    <div style="color: #e74c3c; padding: 16px; background: #2d2d30; border-radius: 4px; margin: 16px 0;">
                                        <strong>⚠️ Mermaid Diagram Error:</strong><br/>
                                        ${e.message || 'Failed to render diagram'}
                                    </div>
                                `;
                            });
                        } catch (e) {
                            console.error('Mermaid setup error:', e);
                        }
                    });
                }, 100);
            }
        } else {
            previewEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👁</div>
                    <div>Start typing to see preview</div>
                </div>
            `;
        }
    }

    closeSplit(splitId) {
        this.splitViews = this.splitViews.filter(split => split.id !== splitId);
        this.renderSplitView();
    }

    renderNormalView() {
        const editorPanes = document.querySelector('.editor-panes');
        editorPanes.innerHTML = `
            <div class="editor-pane">
                <div class="pane-header">📝 Editor</div>
                <div id="editorContainer">
                    <div class="empty-state" id="emptyState">
                        <div class="icon">📝</div>
                        <div>Start by creating a new markdown file</div>
                        <div class="welcome-actions">
                            <button class="btn" onclick="newFile()">New File</button>
                            <button class="btn btn-secondary" onclick="createSample()">Sample Document</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="resizer" id="resizer"></div>

            <div class="editor-pane" id="previewPane">
                <div class="pane-header">👁 Preview</div>
                <div class="preview" id="preview">
                    <div class="empty-state">
                        <div class="icon">👁</div>
                        <div>Preview will appear here</div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupResizer();
        // Don't call renderEditor() and updatePreview() here since DOM references aren't set up yet
    }

    populateParentFolderSelectForFolder() {
        const select = document.getElementById('parentFolderSelectForFolder');
        if (!select) {
            console.error('Parent folder select for folder element not found');
            return;
        }
        
        select.innerHTML = '<option value="">Root Directory</option>';
        
        // Create a recursive function to build folder hierarchy
        const addFolderOptions = (parentId, prefix = '') => {
            Object.entries(this.folders)
                .filter(([id, folder]) => folder.parent === parentId)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name))
                .forEach(([id, folder]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = prefix + folder.name;
                    select.appendChild(option);
                    
                    // Recursively add subfolders with increased indentation
                    addFolderOptions(id, prefix + '  ');
                });
        };
        
        addFolderOptions(null);
    }

    showFolderContextMenu(event, folderId) {
        event.preventDefault();
        
        // Remove any existing context menu
        const existingMenu = document.getElementById('contextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const folder = this.folders[folderId];
        if (!folder) return;
        
        const contextMenu = document.createElement('div');
        contextMenu.id = 'contextMenu';
        contextMenu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #2d2d30;
            border: 1px solid #464647;
            border-radius: 4px;
            min-width: 160px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        
        const menuItems = [
            {
                text: '📦 Download as ZIP',
                action: () => this.downloadFolderAsZip(folderId)
            },
            {
                text: '✏️ Rename',
                action: () => this.showRenameModal(folderId, 'folder')
            },
            {
                text: '🗑️ Delete',
                action: () => this.deleteFolder(folderId)
            }
        ];
        
        menuItems.forEach((menuItem, index) => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                font-size: 13px;
                color: #cccccc;
                transition: background 0.2s;
            `;
            item.textContent = menuItem.text;
            item.onmouseover = () => item.style.background = '#37373d';
            item.onmouseout = () => item.style.background = '';
            item.onclick = () => {
                menuItem.action();
                contextMenu.remove();
            };
            
            if (index === menuItems.length - 1) {
                item.style.borderTop = '1px solid #464647';
                item.style.color = '#e74c3c';
            }
            
            contextMenu.appendChild(item);
        });
        
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    showRenameModal(itemId, itemType) {
        console.log('✏️ ShowRenameModal called for:', itemType, itemId);
        
        const modal = document.getElementById('renameModal');
        const currentNameEl = document.getElementById('currentItemName');
        const newNameInput = document.getElementById('newItemName');
        const helpText = document.getElementById('renameHelp');
        
        if (!modal) {
            console.error('❌ Rename modal not found in DOM');
            alert('Error: Rename modal not found. Please refresh the page.');
            return;
        }
        
        console.log('📋 Modal elements found:', {
            modal: !!modal,
            currentNameEl: !!currentNameEl,
            newNameInput: !!newNameInput,
            helpText: !!helpText
        });
        
        let currentItem;
        if (itemType === 'file') {
            currentItem = this.files[itemId];
            helpText.textContent = 'File names should end with .md extension for markdown files.';
        } else if (itemType === 'folder') {
            currentItem = this.folders[itemId];
            helpText.textContent = 'Folder names cannot contain special characters like / \\ : * ? " < > |';
        }
        
        if (!currentItem) {
            console.error('❌ Item not found:', itemType, itemId);
            alert(`Error: ${itemType} not found. Please refresh the page and try again.`);
            return;
        }
        
        console.log('📁 Current item found:', currentItem.name);
        
        // Store current context
        window.renameContext = {
            itemId: itemId,
            itemType: itemType,
            currentName: currentItem.name
        };
        
        console.log('💾 Stored rename context:', window.renameContext);
        
        currentNameEl.textContent = currentItem.name;
        newNameInput.value = currentItem.name;
        
        modal.style.display = 'block';
        newNameInput.focus();
        newNameInput.select();
        
        console.log('✅ Rename modal opened successfully for:', currentItem.name);
    }

    renameFile(fileId, newName) {
        console.log('✏️ RenameFile called:', fileId, newName);
        
        if (!this.files[fileId]) {
            throw new Error('File not found');
        }
        
        // Validate filename
        if (newName.length === 0) {
            throw new Error('File name cannot be empty');
        }
        
        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(newName)) {
            throw new Error('File name contains invalid characters');
        }
        
        // Check if name already exists in same folder
        const file = this.files[fileId];
        const existingFile = Object.values(this.files).find(f => 
            f.name === newName && f.parent === file.parent && f !== file
        );
        
        if (existingFile) {
            throw new Error('A file with this name already exists in the same folder');
        }
        
        // Update the file name
        const oldName = file.name;
        file.name = newName;
        
        // Save changes and update UI
        this.saveToStorage();
        this.renderFileTree();
        this.renderTabs();
        
        // Update status
        const statusLeft = document.getElementById('statusLeft');
        statusLeft.textContent = `Renamed: ${oldName} → ${newName}`;
        setTimeout(() => {
            this.updateStatus();
        }, 2000);
        
        console.log('✅ File renamed successfully:', oldName, '→', newName);
    }

    renameFolder(folderId, newName) {
        console.log('✏️ RenameFolder called:', folderId, newName);
        
        if (!this.folders[folderId]) {
            throw new Error('Folder not found');
        }
        
        // Validate folder name
        if (newName.length === 0) {
            throw new Error('Folder name cannot be empty');
        }
        
        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(newName)) {
            throw new Error('Folder name contains invalid characters');
        }
        
        // Check if name already exists in same parent folder
        const folder = this.folders[folderId];
        const existingFolder = Object.values(this.folders).find(f => 
            f.name === newName && f.parent === folder.parent && f !== folder
        );
        
        if (existingFolder) {
            throw new Error('A folder with this name already exists in the same location');
        }
        
        // Update the folder name
        const oldName = folder.name;
        folder.name = newName;
        
        // Save changes and update UI
        this.saveToStorage();
        this.renderFileTree();
        
        // Update status
        const statusLeft = document.getElementById('statusLeft');
        statusLeft.textContent = `Renamed: ${oldName} → ${newName}`;
        setTimeout(() => {
            this.updateStatus();
        }, 2000);
        
        console.log('✅ Folder renamed successfully:', oldName, '→', newName);
    }
}

// Global functions
let editor;

function initApp() {
    console.log('🚀 Initializing Markdown Editor...');
    try {
        // Load saved theme preference
        loadThemePreference();
        
    editor = new MarkdownEditor();
        console.log('✅ Editor ready!');
    } catch (error) {
        console.error('❌ Editor initialization failed:', error);
    }
}

// Theme Management Functions
function setTheme(theme) {
    const body = document.body;
    const darkBtn = document.getElementById('darkThemeBtn');
    const lightBtn = document.getElementById('lightThemeBtn');

    if (theme === 'light') {
        body.classList.add('light-theme');
        darkBtn.classList.remove('active');
        lightBtn.classList.add('active');
        console.log('🌞 Light theme activated');
    } else {
        body.classList.remove('light-theme');
        darkBtn.classList.add('active');
        lightBtn.classList.remove('active');
        console.log('🌙 Dark theme activated');
    }

    // Save theme preference to localStorage
    localStorage.setItem('theme', theme);
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Formatting Functions for Toolbar
function getEditor() {
    return document.getElementById('editor');
}

function getSelectionInfo(editor) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    return { start, end, selectedText };
}

function insertTextAtCursor(editor, textBefore, textAfter = '', replacementText = null) {
    const { start, end, selectedText } = getSelectionInfo(editor);
    const textToInsert = replacementText !== null ? replacementText : textBefore + selectedText + textAfter;
    
    editor.setRangeText(textToInsert, start, end, 'end');
    editor.focus();
    
    // Trigger input event to update the file content
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function formatText(type) {
    const editor = getEditor();
    if (!editor) return;

    const { start, end, selectedText } = getSelectionInfo(editor);
    
    switch (type) {
        case 'bold':
            insertTextAtCursor(editor, '**', '**');
            break;
        case 'italic':
            insertTextAtCursor(editor, '*', '*');
            break;
        case 'strikethrough':
            insertTextAtCursor(editor, '~~', '~~');
            break;
        case 'code':
            if (selectedText.includes('\n')) {
                insertTextAtCursor(editor, '```\n', '\n```');
            } else {
                insertTextAtCursor(editor, '`', '`');
            }
            break;
        case 'unorderedList':
            insertListItems(editor, '- ');
            break;
        case 'orderedList':
            insertListItems(editor, '1. ', true);
            break;
        case 'checkList':
            insertListItems(editor, '- [ ] ');
            break;
        case 'quote':
            insertBlockQuote(editor);
            break;
        case 'codeBlock':
            insertCodeBlock(editor);
            break;
        case 'link':
            insertLink(editor);
            break;
        case 'image':
            insertImage(editor);
            break;
        case 'table':
            insertTable(editor);
            break;
        case 'hr':
            insertHorizontalRule(editor);
            break;
    }
}

function insertListItems(editor, prefix, isOrdered = false) {
    const { start, end, selectedText } = getSelectionInfo(editor);
    
    if (selectedText) {
        const lines = selectedText.split('\n');
        let result = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                const currentPrefix = isOrdered ? `${i + 1}. ` : prefix;
                result += currentPrefix + lines[i].trim() + '\n';
            } else {
                result += '\n';
            }
        }
        insertTextAtCursor(editor, '', '', result.trim());
    } else {
        insertTextAtCursor(editor, prefix, '');
    }
}

function insertBlockQuote(editor) {
    const { selectedText } = getSelectionInfo(editor);
    if (selectedText) {
        const lines = selectedText.split('\n');
        const quotedLines = lines.map(line => '> ' + line).join('\n');
        insertTextAtCursor(editor, '', '', quotedLines);
    } else {
        insertTextAtCursor(editor, '> ', '');
    }
}

function insertCodeBlock(editor) {
    const { selectedText } = getSelectionInfo(editor);
    const language = prompt('Programlama dili (isteğe bağlı):') || '';
    insertTextAtCursor(editor, `\`\`\`${language}\n`, '\n```');
}

function insertLink(editor) {
    const { selectedText } = getSelectionInfo(editor);
    const url = prompt('Bağlantı URL\'si:', 'https://');
    const linkText = selectedText || prompt('Bağlantı metni:', '');
    
    if (url && linkText) {
        insertTextAtCursor(editor, '', '', `[${linkText}](${url})`);
    }
}

function insertImage(editor) {
    const url = prompt('Resim URL\'si:', 'https://');
    const altText = prompt('Alternatif metin:', '');
    
    if (url) {
        insertTextAtCursor(editor, '', '', `![${altText || 'Resim'}](${url})`);
    }
}

function insertTable(editor) {
    const rows = parseInt(prompt('Satır sayısı:', '3')) || 3;
    const cols = parseInt(prompt('Sütun sayısı:', '3')) || 3;
    
    let table = '';
    
    // Header row
    table += '|';
    for (let j = 0; j < cols; j++) {
        table += ` Başlık ${j + 1} |`;
    }
    table += '\n';
    
    // Separator row
    table += '|';
    for (let j = 0; j < cols; j++) {
        table += ' --- |';
    }
    table += '\n';
    
    // Data rows
    for (let i = 0; i < rows - 1; i++) {
        table += '|';
        for (let j = 0; j < cols; j++) {
            table += ` Veri ${i + 1}.${j + 1} |`;
        }
        table += '\n';
    }
    
    insertTextAtCursor(editor, '\n', '\n', table);
}

function insertHorizontalRule(editor) {
    insertTextAtCursor(editor, '\n---\n', '');
}

function insertHeading() {
    const select = document.getElementById('headingSelect');
    const level = select.value;
    
    if (level) {
        const editor = getEditor();
        if (editor) {
            const prefix = '#'.repeat(parseInt(level)) + ' ';
            insertTextAtCursor(editor, prefix, '');
        }
        select.value = ''; // Reset select
    }
}

function toggleColorPicker() {
    const picker = document.getElementById('colorPicker');
    const isVisible = picker.style.display === 'block';
    
    // Hide all dropdowns first
    document.getElementById('symbolMenu').style.display = 'none';
    
    picker.style.display = isVisible ? 'none' : 'block';
}

function insertColor(color) {
    const editor = getEditor();
    if (editor) {
        const { selectedText } = getSelectionInfo(editor);
        const text = selectedText || 'renkli metin';
        insertTextAtCursor(editor, '', '', `<span style="color: ${color}">${text}</span>`);
    }
    document.getElementById('colorPicker').style.display = 'none';
}

function toggleSymbolMenu() {
    const menu = document.getElementById('symbolMenu');
    const isVisible = menu.style.display === 'block';
    
    // Hide all dropdowns first
    document.getElementById('colorPicker').style.display = 'none';
    
    menu.style.display = isVisible ? 'none' : 'block';
}

function insertSymbol(symbol) {
    const editor = getEditor();
    if (editor) {
        insertTextAtCursor(editor, symbol, '');
    }
    document.getElementById('symbolMenu').style.display = 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    const colorPicker = document.getElementById('colorPicker');
    const symbolMenu = document.getElementById('symbolMenu');
    
    if (colorPicker && !event.target.closest('.color-picker-wrapper')) {
        colorPicker.style.display = 'none';
    }
    
    if (symbolMenu && !event.target.closest('.symbol-dropdown')) {
        symbolMenu.style.display = 'none';
    }
});

function newFile() {
    if (!editor) {
        console.error('❌ Editor not initialized!');
        alert('Editor not initialized. Please refresh the page.');
        return;
    }
    try {
    editor.newFile();
    } catch (error) {
        console.error('❌ Error opening new file dialog:', error);
    }
}

// Solution Explorer Functions
let explorerViewMode = 'structure'; // 'structure' or 'summary'

function updateSolutionExplorer(content) {
    if (!content || content.trim() === '') {
        showEmptyExplorer();
        return;
    }

    if (explorerViewMode === 'structure') {
        analyzeContentStructure(content);
    } else {
        generateContentSummary(content);
    }
}

function analyzeContentStructure(content) {
    const structures = [];
    const lines = content.split('\n');
    
    // Track indices for elements that can appear multiple times
    let tableIndex = 0;
    let codeBlockIndex = 0;
    let quoteIndex = 0;

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Headers
        const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const text = headerMatch[2].trim();
            structures.push({
                type: 'header',
                level: level,
                text: text,
                line: lineNum,
                icon: getHeaderIcon(level)
            });
            return;
        }

        // Links
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (linkMatch) {
            linkMatch.forEach(link => {
                const linkParts = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (linkParts) {
                    structures.push({
                        type: 'link',
                        text: linkParts[1],
                        url: linkParts[2],
                        line: lineNum,
                        icon: '🔗'
                    });
                }
            });
        }

        // Images
        const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
        if (imageMatch) {
            imageMatch.forEach(image => {
                const imageParts = image.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                if (imageParts) {
                    structures.push({
                        type: 'image',
                        text: imageParts[1] || 'Image',
                        url: imageParts[2],
                        line: lineNum,
                        icon: '🖼️'
                    });
                }
            });
        }

        // Code blocks (opening tag)
        if (line.trim().startsWith('```')) {
            const language = line.replace('```', '').trim() || 'code';
            let icon = '💻';
            let text = `Code Block (${language})`;
            
            // Special handling for Mermaid diagrams
            if (language.toLowerCase() === 'mermaid') {
                icon = '📊';
                text = 'Mermaid Diagram';
            }
            
            structures.push({
                type: 'codeblock',
                text: text,
                line: lineNum,
                index: codeBlockIndex,
                icon: icon,
                language: language
            });
            codeBlockIndex++;
        }

        // Tables (detect table headers - lines with pipes that are likely table rows)
        if (line.includes('|') && line.split('|').length > 2 && !line.trim().match(/^[\|\s\-:]+$/)) {
            const columns = line.split('|').filter(cell => cell.trim()).length;
            // Only add if this is the first row of a table (not a separator row)
            const isTableSeparator = line.trim().match(/^[\|\s\-:]+$/);
            if (!isTableSeparator) {
                structures.push({
                    type: 'table',
                    text: `Table (${columns} columns)`,
                    line: lineNum,
                    index: tableIndex,
                    icon: '📊'
                });
                tableIndex++;
            }
        }

        // Quotes
        if (line.trim().startsWith('>')) {
            const quoteText = line.replace(/^>\s*/, '').trim();
            structures.push({
                type: 'quote',
                text: quoteText.substring(0, 50) + (quoteText.length > 50 ? '...' : ''),
                line: lineNum,
                index: quoteIndex,
                icon: '💬'
            });
            quoteIndex++;
        }

        // Lists
        if (line.match(/^\s*[-*+]\s/) || line.match(/^\s*\d+\.\s/)) {
            const listText = line.replace(/^\s*[-*+\d.]\s*/, '').trim();
            structures.push({
                type: 'list',
                text: listText.substring(0, 50) + (listText.length > 50 ? '...' : ''),
                line: lineNum,
                icon: '📝'
            });
        }
    });

    renderExplorerStructure(structures);
}

function generateContentSummary(content) {
    const stats = {
        lines: content.split('\n').length,
        words: content.split(/\s+/).filter(word => word.length > 0).length,
        characters: content.length,
        charactersNoSpaces: content.replace(/\s/g, '').length,
        headers: (content.match(/^#{1,6}\s/gm) || []).length,
        links: (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length,
        images: (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length,
        codeBlocks: (content.match(/```/g) || []).length / 2,
        tables: (content.split('\n').filter(line => line.includes('|'))).length
    };

    renderExplorerSummary(stats);
}

function renderExplorerStructure(structures) {
    const explorerContent = document.getElementById('explorerContent');
    
    if (structures.length === 0) {
        showEmptyExplorer();
        return;
    }

    let html = '';
    structures.forEach((item, index) => {
        const cssClass = item.type === 'header' ? `structure-${item.type} structure-h${item.level}` : `structure-${item.type}`;
        const elementIndex = item.index || 0;
        html += `
            <div class="structure-item ${cssClass}" onclick="goToElementAndPreview(${item.line}, '${item.type}', '${item.text.replace(/'/g, "\\'")}', ${item.level || 0}, ${elementIndex})" title="Satır ${item.line}">
                <span class="structure-icon">${item.icon}</span>
                <span class="structure-text">${item.text}</span>
                <span class="structure-info">L${item.line}</span>
            </div>
        `;
    });

    explorerContent.innerHTML = html;
}

function renderExplorerSummary(stats) {
    const explorerContent = document.getElementById('explorerContent');
    
    const html = `
        <div class="structure-item">
            <span class="structure-icon">📄</span>
            <span class="structure-text">Satır Sayısı</span>
            <span class="structure-info">${stats.lines}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">📝</span>
            <span class="structure-text">Kelime Sayısı</span>
            <span class="structure-info">${stats.words}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">🔤</span>
            <span class="structure-text">Karakter (Boşluksuz)</span>
            <span class="structure-info">${stats.charactersNoSpaces}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">📖</span>
            <span class="structure-text">Başlık</span>
            <span class="structure-info">${stats.headers}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">🔗</span>
            <span class="structure-text">Bağlantı</span>
            <span class="structure-info">${stats.links}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">🖼️</span>
            <span class="structure-text">Resim</span>
            <span class="structure-info">${stats.images}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">💻</span>
            <span class="structure-text">Kod Bloğu</span>
            <span class="structure-info">${Math.floor(stats.codeBlocks)}</span>
        </div>
        <div class="structure-item">
            <span class="structure-icon">📊</span>
            <span class="structure-text">Tablo</span>
            <span class="structure-info">${stats.tables}</span>
        </div>
    `;

    explorerContent.innerHTML = html;
}

function showEmptyExplorer() {
    const explorerContent = document.getElementById('explorerContent');
    explorerContent.innerHTML = `
        <div class="explorer-empty">
            <div class="icon">📄</div>
            <div>Dosya seçildiğinde içerik burada görünecek</div>
        </div>
    `;
}

function getHeaderIcon(level) {
    const icons = ['📚', '📖', '📄', '📝', '🔸', '🔹'];
    return icons[level - 1] || '•';
}

function goToElementAndPreview(lineNumber, elementType, elementText, level = 0, elementIndex = 0) {
    // First, navigate in the editor
    goToLineInEditor(lineNumber);
    
    // Then sync with preview
    syncWithPreview(elementType, elementText, level, elementIndex);
}

function goToLineInEditor(lineNumber) {
    const editor = document.getElementById('editor');
    if (editor) {
        const lines = editor.value.split('\n');
        let charPosition = 0;
        
        for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
            charPosition += lines[i].length + 1; // +1 for newline
        }
        
        editor.focus();
        editor.setSelectionRange(charPosition, charPosition);
        
        // Calculate scroll position (approximate)
        const lineHeight = 20; // Approximate line height
        const scrollTop = Math.max(0, (lineNumber - 5) * lineHeight);
        editor.scrollTop = scrollTop;
        
        // Highlight the clicked line temporarily
        setTimeout(() => {
            const endPosition = charPosition + (lines[lineNumber - 1] || '').length;
            editor.setSelectionRange(charPosition, endPosition);
        }, 100);
    }
}

function syncWithPreview(elementType, elementText, level = 0, elementIndex = 0) {
    const preview = document.getElementById('preview');
    if (!preview) return;

    let targetElement = null;

    switch (elementType) {
        case 'header':
            targetElement = findHeaderInPreview(preview, elementText, level);
            break;
        case 'link':
            targetElement = findLinkInPreview(preview, elementText);
            break;
        case 'image':
            targetElement = findImageInPreview(preview, elementText);
            break;
        case 'table':
            targetElement = findTableInPreview(preview, elementIndex);
            break;
        case 'codeblock':
            targetElement = findCodeBlockInPreview(preview, elementIndex);
            break;
        case 'quote':
            targetElement = findQuoteInPreview(preview, elementText, elementIndex);
            break;
        default:
            // For other elements, try to find by text content
            targetElement = findElementByText(preview, elementText);
    }

    if (targetElement) {
        scrollToPreviewElement(targetElement);
        highlightPreviewElement(targetElement);
    }
}

function findHeaderInPreview(preview, headerText, level) {
    const headerTag = `h${level}`;
    const headers = preview.querySelectorAll(headerTag);
    
    for (let header of headers) {
        if (header.textContent.trim() === headerText.trim()) {
            return header;
        }
    }
    return null;
}

function findLinkInPreview(preview, linkText) {
    const links = preview.querySelectorAll('a');
    
    for (let link of links) {
        if (link.textContent.trim() === linkText.trim()) {
            return link;
        }
    }
    return null;
}

function findImageInPreview(preview, altText) {
    const images = preview.querySelectorAll('img');
    
    for (let img of images) {
        if (img.alt === altText || img.title === altText) {
            return img;
        }
    }
    return null;
}

function findTableInPreview(preview, tableIndex = 0) {
    const tables = preview.querySelectorAll('table');
    return tables[tableIndex] || tables[0] || null;
}

function findCodeBlockInPreview(preview, codeBlockIndex = 0) {
    // First try to find Mermaid diagrams
    const mermaidDiagrams = preview.querySelectorAll('.mermaid');
    const regularCodeBlocks = preview.querySelectorAll('pre code');
    
    // Combine both types and sort by their position in the document
    const allBlocks = [];
    
    mermaidDiagrams.forEach(diagram => allBlocks.push(diagram));
    regularCodeBlocks.forEach(code => allBlocks.push(code.parentElement));
    
    // Sort by document order
    allBlocks.sort((a, b) => {
        const aPos = a.compareDocumentPosition(b);
        return aPos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    return allBlocks[codeBlockIndex] || allBlocks[0] || null;
}

function findQuoteInPreview(preview, quoteText, elementIndex = 0) {
    const quotes = preview.querySelectorAll('blockquote');
    
    // First try to find by index
    if (quotes[elementIndex]) {
        return quotes[elementIndex];
    }
    
    // Fallback to finding by text content
    for (let quote of quotes) {
        if (quote.textContent.includes(quoteText.substring(0, 30))) {
            return quote;
        }
    }
    return null;
}

function findElementByText(preview, text) {
    const walker = document.createTreeWalker(
        preview,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.includes(text.substring(0, 20))) {
            return node.parentElement;
        }
    }
    return null;
}

function scrollToPreviewElement(element) {
    const preview = document.getElementById('preview');
    if (!preview || !element) return;

    // Calculate the position of the element relative to the preview container
    const elementRect = element.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const scrollTop = preview.scrollTop;
    
    // Calculate the desired scroll position (element should be near the top)
    const targetScrollTop = scrollTop + (elementRect.top - previewRect.top) - 50;
    
    // Smooth scroll to the element
    preview.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });
}

function highlightPreviewElement(element) {
    if (!element) return;

    // Remove any existing highlights
    const existingHighlights = document.querySelectorAll('.preview-highlight');
    existingHighlights.forEach(el => el.classList.remove('preview-highlight'));

    // Add highlight class
    element.classList.add('preview-highlight');

    // Remove highlight after 3 seconds
    setTimeout(() => {
        element.classList.remove('preview-highlight');
    }, 3000);
}

function refreshExplorer() {
    if (editor && editor.activeFile) {
        const content = editor.files[editor.activeFile].content;
        updateSolutionExplorer(content);
    }
}

function toggleExplorerView() {
    const btn = document.getElementById('explorerViewBtn');
    explorerViewMode = explorerViewMode === 'structure' ? 'summary' : 'structure';
    
    btn.textContent = explorerViewMode === 'structure' ? '📖' : '📊';
    btn.title = explorerViewMode === 'structure' ? 'Özet Görünümü' : 'Yapı Görünümü';
    
    refreshExplorer();
}

// Initialize sidebar splitter
function initializeSidebarSplitter() {
    const splitter = document.getElementById('sidebarSplitter');
    const fileTreeContainer = document.querySelector('.file-tree-container');
    const solutionExplorer = document.getElementById('solutionExplorer');
    
    if (!splitter || !fileTreeContainer || !solutionExplorer) return;
    
    let isResizing = false;
    
    splitter.addEventListener('mousedown', (e) => {
        isResizing = true;
        splitter.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const sidebar = document.querySelector('.sidebar');
        const rect = sidebar.getBoundingClientRect();
        const totalHeight = rect.height;
        const mouseY = e.clientY - rect.top;
        
        const minHeight = 150;
        const maxHeight = totalHeight - 150;
        const newHeight = Math.max(minHeight, Math.min(maxHeight, mouseY));
        
        const fileTreeHeight = newHeight;
        const explorerHeight = totalHeight - newHeight - 4; // 4px for splitter
        
        fileTreeContainer.style.height = fileTreeHeight + 'px';
        solutionExplorer.style.height = explorerHeight + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            splitter.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// Initialize splitter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeSidebarSplitter();
});

function createNewFile() {
    editor.createNewFile();
}

function closeModal(modalId) {
    editor.closeModal(modalId);
}

function showExportModal() {
    console.log('🌍 Global showExportModal called');
    if (!editor) {
        console.error('❌ Editor not initialized!');
        alert('Editor not initialized. Please refresh the page.');
        return;
    }
    editor.showExportModal();
}

function performExport() {
    console.log('🌍 Global performExport called');
    if (!editor) {
        console.error('❌ Editor not initialized!');
        alert('Editor not initialized. Please refresh the page.');
        return;
    }
    editor.performExport();
}

function saveFile() {
    editor.saveFile();
}

function exportFile() {
    editor.showExportModal();
}

function togglePreview() {
    editor.togglePreview();
}

function createSample() {
    editor.createSample();
}

// Folder management functions
function createNewFolder() {
    document.getElementById('newFolderModal').style.display = 'block';
    document.getElementById('newFolderName').focus();
    document.getElementById('newFolderName').value = '';
    editor.populateParentFolderSelectForFolder();
}

function createNewFolderConfirm() {
    const name = document.getElementById('newFolderName').value.trim();
    const parentFolderId = document.getElementById('parentFolderSelectForFolder').value;
    
    if (!name) {
        alert('Please enter a folder name.');
        return;
    }
    
    try {
        let folderId;
        if (parentFolderId && parentFolderId !== '') {
            // Check if the parent folder still exists
            if (!editor.folders[parentFolderId]) {
                alert('Selected parent folder no longer exists. Please select another folder or use root directory.');
                editor.populateParentFolderSelectForFolder(); // Refresh the dropdown
                return;
            }
            folderId = editor.createFolder(name, parentFolderId);
        } else {
            // Create in root directory
            folderId = editor.createFolder(name, null);
        }
        
        editor.closeModal('newFolderModal');
        
        // Show success message
        const statusLeft = document.getElementById('statusLeft');
        statusLeft.textContent = `Created folder: ${name}`;
        setTimeout(() => {
            editor.updateStatus();
        }, 2000);
        
    } catch (error) {
        console.error('Folder creation error:', error);
        alert('Failed to create folder: ' + error.message);
    }
}

// File upload handlers
function uploadFile() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Accept various markdown file types
        if (file.name.endsWith('.md') || 
            file.name.endsWith('.markdown') || 
            file.name.endsWith('.txt') ||
            file.type === 'text/markdown' || 
            file.type === 'text/plain' || 
            file.type === '' || // For files without MIME type
            file.type === 'text/markdown;charset=utf-8') {
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileName = file.name;
                const fileContent = e.target.result;
                
                // Ensure .md extension
                const finalFileName = fileName.endsWith('.md') ? fileName : 
                                    fileName.endsWith('.txt') ? fileName.replace('.txt', '.md') :
                                    fileName.endsWith('.markdown') ? fileName :
                                    fileName + '.md';
                
                const id = editor.createFile(finalFileName, fileContent);
                editor.openFile(id);
                
                // Show success message
                const statusLeft = document.getElementById('statusLeft');
                const originalText = statusLeft.textContent;
                statusLeft.textContent = `Imported: ${finalFileName}`;
                setTimeout(() => {
                    editor.updateStatus();
                }, 2000);
            };
            reader.readAsText(file);
        } else {
            alert(`File "${file.name}" is not supported. Please select markdown (.md), text (.txt), or markdown (.markdown) files.`);
        }
    }
    event.target.value = ''; // Clear the input
}

function handleFileDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    let importedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Accept various markdown file types
        if (file.name.endsWith('.md') || 
            file.name.endsWith('.markdown') || 
            file.name.endsWith('.txt') ||
            file.type === 'text/markdown' || 
            file.type === 'text/plain' || 
            file.type === '' || // For files without MIME type
            file.type === 'text/markdown;charset=utf-8') {
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileName = file.name;
                const fileContent = e.target.result;
                
                // Ensure .md extension
                const finalFileName = fileName.endsWith('.md') ? fileName : 
                                    fileName.endsWith('.txt') ? fileName.replace('.txt', '.md') :
                                    fileName.endsWith('.markdown') ? fileName :
                                    fileName + '.md';
                
                const id = editor.createFile(finalFileName, fileContent);
                importedCount++;
                
                // Open the last imported file
                if (i === files.length - 1) {
                    editor.openFile(id);
                }
                
                // Show success message
                if (importedCount === files.length) {
                    const statusLeft = document.getElementById('statusLeft');
                    statusLeft.textContent = `Imported ${importedCount} file(s)`;
                    setTimeout(() => {
                        editor.updateStatus();
                    }, 2000);
                }
            };
            reader.readAsText(file);
        } else {
            alert(`File "${file.name}" is not supported. Please drop markdown (.md), text (.txt), or markdown (.markdown) files.`);
        }
    }
    
    // Remove dragover styling
    document.querySelector('.file-upload-area').classList.remove('dragover');
}

function handleDragOver(event) {
    event.preventDefault();
    document.querySelector('.file-upload-area').classList.add('dragover');
}

function handleDragLeave(event) {
    document.querySelector('.file-upload-area').classList.remove('dragover');
}

// Diagram editor functions
function showDiagramEditor() {
    document.getElementById('diagramModal').style.display = 'block';
    updateDiagramTemplate();
}

function updateDiagramTemplate() {
    const diagramType = document.getElementById('diagramType').value;
    const diagramInput = document.getElementById('diagramInput');
    const diagramPreview = document.getElementById('diagramPreview');
    
    let template = '';
    
    switch (diagramType) {
        case 'flowchart':
            template = `graph TD
A[Start] --> B{Decision?}
B -->|Yes| C[Process A]
B -->|No| D[Process B]
C --> E[End]
D --> E`;
            break;
            
        case 'sequence':
            template = `sequenceDiagram
participant A as User
participant B as System
A->>B: Request
B-->>A: Response`;
            break;
            
        case 'class':
            template = `classDiagram
class User {
+String name
+String email
+login()
+logout()
}`;
            break;
            
        case 'json-flowchart':
            template = `{
"id": "001",
"position": {
"x": 20,
"y": 1,
"z": 300
},
"sleeping": false,
"items": [
"Phone",
"Apple"
]
}`;
            break;
    }
    
    diagramInput.value = template;
    updateDiagramPreview();
    
    // Add input listener for real-time preview
    diagramInput.onkeyup = updateDiagramPreview;
}

function updateDiagramPreview() {
    const diagramType = document.getElementById('diagramType').value;
    const diagramInput = document.getElementById('diagramInput').value;
    const diagramPreview = document.getElementById('diagramPreview');
    
    if (!diagramInput.trim()) {
        diagramPreview.innerHTML = '<div style="color: #6f6f6f;">Enter diagram code to see preview</div>';
        return;
    }
    
    if (diagramType === 'json-flowchart') {
        try {
            const jsonData = JSON.parse(diagramInput);
            const mermaidCode = convertJSONToMermaid(jsonData);
            renderMermaidPreview(mermaidCode, diagramPreview);
        } catch (e) {
            diagramPreview.innerHTML = `<div style="color: #e74c3c;">Invalid JSON: ${e.message}</div>`;
        }
    } else {
        renderMermaidPreview(diagramInput, diagramPreview);
    }
}

function convertJSONToMermaid(json, parentId = null, visited = new Set()) {
    let mermaidCode = parentId ? '' : 'graph TD\n';
    
    if (typeof json !== 'object' || json === null) {
        return mermaidCode;
    }
    
    // Create unique ID for this object
    const objId = parentId || 'root';
    
    // Prevent circular references
    if (visited.has(json)) {
        return mermaidCode;
    }
    visited.add(json);
    
    Object.entries(json).forEach(([key, value], index) => {
        const nodeId = `${objId}_${key}_${index}`;
        
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                mermaidCode += `    ${objId}["${objId === 'root' ? 'Object' : objId}"] --> ${nodeId}["${key}: Array"]\n`;
                value.forEach((item, i) => {
                    const itemId = `${nodeId}_${i}`;
                    if (typeof item === 'object' && item !== null) {
                        mermaidCode += `    ${nodeId} --> ${itemId}["${JSON.stringify(item).substring(0, 20)}..."]\n`;
                    } else {
                        mermaidCode += `    ${nodeId} --> ${itemId}["${item}"]\n`;
                    }
                });
            } else {
                mermaidCode += `    ${objId}["${objId === 'root' ? 'Object' : objId}"] --> ${nodeId}["${key}"]\n`;
                mermaidCode += convertJSONToMermaid(value, nodeId, visited);
            }
        } else {
            mermaidCode += `    ${objId}["${objId === 'root' ? 'Object' : objId}"] --> ${nodeId}["${key}: ${value}"]\n`;
        }
    });
    
    return mermaidCode;
}

function renderMermaidPreview(code, container) {
    if (typeof mermaid === 'undefined') {
        container.innerHTML = '<div style="color: #e74c3c;">Mermaid library not loaded</div>';
        return;
    }
    
    try {
        const previewId = `preview-${Date.now()}`;
        mermaid.render(previewId, code).then(result => {
            container.innerHTML = result.svg;
        }).catch(e => {
            container.innerHTML = `<div style="color: #e74c3c;">Diagram Error: ${e.message}</div>`;
        });
    } catch (e) {
        container.innerHTML = `<div style="color: #e74c3c;">Error: ${e.message}</div>`;
    }
}

function insertDiagram() {
    const diagramType = document.getElementById('diagramType').value;
    const diagramInput = document.getElementById('diagramInput').value;
    
    if (!diagramInput.trim()) {
        alert('Please enter diagram code');
        return;
    }
    
    let diagramCode = '';
    
    if (diagramType === 'json-flowchart') {
        try {
            const jsonData = JSON.parse(diagramInput);
            diagramCode = convertJSONToMermaid(jsonData);
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
            return;
        }
    } else {
        diagramCode = diagramInput;
    }
    
    const markdownCode = `\n\`\`\`mermaid\n${diagramCode}\n\`\`\`\n`;
    
    if (editor.activeFile) {
        const currentEditor = document.getElementById('editor');
        if (currentEditor) {
            const cursorPos = currentEditor.selectionStart;
            const currentContent = currentEditor.value;
            const newContent = currentContent.substring(0, cursorPos) + markdownCode + currentContent.substring(cursorPos);
            currentEditor.value = newContent;
            editor.updateFileContent(newContent);
            currentEditor.focus();
            currentEditor.setSelectionRange(cursorPos + markdownCode.length, cursorPos + markdownCode.length);
        }
    }
    
    editor.closeModal('diagramModal');
}

// Link Modal functions
function showLinkModal() {
    document.getElementById('linkModal').style.display = 'block';
    updateLinkOptions();
}

function updateLinkOptions() {
    const linkTypeSelect = document.getElementById('linkType');
    const internalLinkOptions = document.getElementById('internalLinkOptions');
    const externalLinkOptions = document.getElementById('externalLinkOptions');

    if (linkTypeSelect.value === 'internal') {
        internalLinkOptions.style.display = 'block';
        externalLinkOptions.style.display = 'none';
        document.getElementById('targetFileSelect').innerHTML = '<option value="">-- Select a file --</option>';
        populateTargetFileSelect();
    } else {
        internalLinkOptions.style.display = 'none';
        externalLinkOptions.style.display = 'block';
        document.getElementById('targetFileSelect').innerHTML = '<option value="">-- Select a file --</option>';
        document.getElementById('externalUrl').value = '';
        document.getElementById('linkText').value = '';
    }
}

function populateTargetFileSelect() {
    const select = document.getElementById('targetFileSelect');
    select.innerHTML = '<option value="">-- Select a file --</option>';
    
    Object.entries(editor.files)
        .filter(([id, file]) => file.name.toLowerCase().endsWith('.md')) // Only show .md files
        .sort(([,a], [,b]) => a.name.localeCompare(b.name))
        .forEach(([id, file]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = file.name;
            select.appendChild(option);
        });
}

function insertLink() {
    const linkType = document.getElementById('linkType').value;
    const targetFileSelect = document.getElementById('targetFileSelect');
    const externalUrl = document.getElementById('externalUrl').value;
    const linkText = document.getElementById('linkText').value;

    if (linkType === 'internal') {
        if (targetFileSelect.value === '') {
            alert('Please select a file for internal link.');
            return;
        }
        const targetFileId = targetFileSelect.value;
        const targetFileName = editor.files[targetFileId].name;
        const markdownLink = `[[${targetFileName}]]`;

        if (linkText) {
            const newContent = markdownLink + ' (' + linkText + ')';
            if (editor.activeFile) {
                const currentEditor = document.getElementById('editor');
                if (currentEditor) {
                    const cursorPos = currentEditor.selectionStart;
                    const currentContent = currentEditor.value;
                    const newContent = currentContent.substring(0, cursorPos) + markdownLink + ' (' + linkText + ')';
                    currentEditor.value = newContent;
                    editor.updateFileContent(newContent);
                    currentEditor.focus();
                    currentEditor.setSelectionRange(cursorPos + markdownLink.length + 1 + linkText.length + 2, cursorPos + markdownLink.length + 1 + linkText.length + 2);
                }
            }
        } else {
            if (editor.activeFile) {
                const currentEditor = document.getElementById('editor');
                if (currentEditor) {
                    const cursorPos = currentEditor.selectionStart;
                    const currentContent = currentEditor.value;
                    const newContent = currentContent.substring(0, cursorPos) + markdownLink;
                    currentEditor.value = newContent;
                    editor.updateFileContent(newContent);
                    currentEditor.focus();
                    currentEditor.setSelectionRange(cursorPos + markdownLink.length, cursorPos + markdownLink.length);
                }
            }
        }
    } else { // External URL
        if (!externalUrl) {
            alert('Please enter a URL for external link.');
            return;
        }
        if (!linkText) {
            alert('Please enter a display text for external link.');
            return;
        }
        const markdownLink = `[${linkText}](${externalUrl})`;

        if (editor.activeFile) {
            const currentEditor = document.getElementById('editor');
            if (currentEditor) {
                const cursorPos = currentEditor.selectionStart;
                const currentContent = currentEditor.value;
                const newContent = currentContent.substring(0, cursorPos) + markdownLink;
                currentEditor.value = newContent;
                editor.updateFileContent(newContent);
                currentEditor.focus();
                currentEditor.setSelectionRange(cursorPos + markdownLink.length, cursorPos + markdownLink.length);
            }
        }
    }
    editor.closeModal('linkModal');
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 Page loaded, initializing...');
    initApp();
});

// Tree view toggle function
/*
function toggleTreeView() {
    editor.toggleTreeView();
}*/

// Download all files as ZIP
function downloadAllAsZip() {
    editor.downloadAllAsZip();
}

// Multiple file viewing functionality
function openFileInNewTab(fileId) {
    // Implementation for opening files in new tabs
    editor.openFile(fileId);
}

function splitViewVertical() {
    // Simple implementation: if we have an active file, create a split
    if (!editor.activeFile) {
        alert('Please open a file first to use split view.');
        return;
    }
    
    if (editor.splitMode) {
        // Close split view
        editor.splitMode = false;
        editor.renderNormalView();
        
        // Update split button state
        const splitBtn = document.querySelector('.menu-item[onclick="splitViewVertical()"]');
        if (splitBtn) {
            splitBtn.style.background = '';
        }
    } else {
        // Enter split mode
        editor.splitMode = true;
        
        // If we have multiple open files, use the next one for split
        let splitFileId = editor.activeFile;
        if (editor.openFiles.length > 1) {
            const currentIndex = editor.openFiles.indexOf(editor.activeFile);
            const nextIndex = (currentIndex + 1) % editor.openFiles.length;
            splitFileId = editor.openFiles[nextIndex];
        }
        
        // Initialize split views with current file and split file
        editor.splitViews = [
            { id: 'split_1', fileId: editor.activeFile, previewVisible: true },
            { id: 'split_2', fileId: splitFileId, previewVisible: true }
        ];
        
        editor.renderSplitView();
        
        // Update split button state
        const splitBtn = document.querySelector('.menu-item[onclick="splitViewVertical()"]');
        if (splitBtn) {
            splitBtn.style.background = '#007acc';
        }
    }
}

function splitViewHorizontal() {
    // For now, use the same as vertical - can be enhanced later
    splitViewVertical();
}

function closeSplitView() {
    editor.splitViews = [];
    editor.splitMode = false;
    editor.renderNormalView();
}

// Rename functionality
function confirmRename() {
    console.log('✏️ ConfirmRename called');
    
    if (!window.renameContext) {
        console.error('❌ No rename context found');
        alert('Error: No rename context found. Please try again.');
        return;
    }
    
    const newName = document.getElementById('newItemName').value.trim();
    if (!newName) {
        alert('Please enter a name.');
        return;
    }
    
    if (newName === window.renameContext.currentName) {
        console.log('✏️ Name unchanged, closing modal');
        editor.closeModal('renameModal');
        return;
    }
    
    try {
        if (window.renameContext.itemType === 'file') {
            editor.renameFile(window.renameContext.itemId, newName);
        } else if (window.renameContext.itemType === 'folder') {
            editor.renameFolder(window.renameContext.itemId, newName);
        }
        
        editor.closeModal('renameModal');
        console.log('✅ Rename completed successfully');
        
    } catch (error) {
        console.error('❌ Rename failed:', error);
        alert('Rename failed: ' + error.message);
    } finally {
        window.renameContext = null;
    }
}

// Test functions for debugging
function testDownload() {
    console.log('🧪 Testing download functionality...');
    if (!editor.activeFile) {
        alert('Please open a file first to test download.');
        return;
    }
    
    const file = editor.files[editor.activeFile];
    const blob = new Blob([file.content || 'Test content'], { type: 'text/plain' });
    editor.downloadFile(blob, 'test.txt');
    console.log('✅ Test download completed');
}

function testRename() {
    console.log('🧪 Testing rename functionality...');
    if (!editor.activeFile) {
        alert('Please open a file first to test rename.');
        return;
    }
    
    try {
        editor.showRenameModal(editor.activeFile, 'file');
        console.log('✅ Test rename modal opened');
    } catch (error) {
        console.error('❌ Test rename failed:', error);
        alert('Test rename failed: ' + error.message);
    }
}

// Add test buttons to console for debugging
console.log('🚀 Markdown Editor - Export System Fixed!');
console.log('✅ All export formats (MD, TXT, HTML, PDF) now work correctly');
console.log('🧪 Debug functions available:');
console.log('- testDownload() - Test download functionality');
console.log('- testRename() - Test rename functionality');
console.log('- Right-click any file to see context menu with rename option');
console.log('📝 Use Export button to export files in different formats');

// ======================
// BACKUP & IMPORT FUNCTIONS
// ======================

function exportAllFiles() {
    console.log('📦 Exporting all files as backup...');
    
    const backupData = {
        files: JSON.parse(JSON.stringify(editor.files || {})),
        folders: JSON.parse(JSON.stringify(editor.folders || {})),
        fileCounter: editor.fileCounter || 0,
        folderCounter: editor.folderCounter || 0,
        openFiles: [...(editor.openFiles || [])],
        exportDate: new Date().toISOString(),
        version: '1.0',
        editorVersion: 'MarkdownEditor v5.0'
    };
    
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `markdown-editor-backup-${timestamp}.json`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`✅ Backup exported as: ${filename}`);
    
    // Show success message
    const statusLeft = document.getElementById('statusLeft');
    if (statusLeft) {
        statusLeft.textContent = `Backup saved as: ${filename}`;
        setTimeout(() => {
            editor.updateStatus();
        }, 3000);
    }
}

function showImportModal() {
    console.log('📥 Opening import modal...');
    document.getElementById('importModal').style.display = 'block';
    
    // Reset file input
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
}

function performImport() {
    console.log('📥 Performing import...');
    
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a backup file to import.');
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        alert('Please select a valid JSON backup file.');
        return;
    }
    
    // Show confirmation dialog
    const confirmMessage = 'Are you sure you want to import this backup?\\n\\n' +
        'This will REPLACE all your current files and folders.\\n' +
        'Current data will be permanently lost.\\n\\n' +
        'Make sure you have created a backup of your current work if needed.';
    
    if (!confirm(confirmMessage)) {
        console.log('📥 Import cancelled by user');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // Validate backup data structure
            if (!backupData.files && !backupData.folders) {
                throw new Error('Invalid backup file: Missing files or folders data');
            }
            
            console.log('📥 Backup data loaded:', backupData);
            
            // Restore data to editor
            editor.files = backupData.files || {};
            editor.folders = backupData.folders || {};
            editor.fileCounter = backupData.fileCounter || 0;
            editor.folderCounter = backupData.folderCounter || 0;
            editor.openFiles = backupData.openFiles || [];
            
            // Save to localStorage
            editor.saveToStorage();
            
            // Refresh UI
            editor.renderFileTree();
            
            // Open first file if available
            const fileIds = Object.keys(editor.files);
            if (fileIds.length > 0) {
                const firstFileId = fileIds[0];
                editor.openFile(firstFileId);
            } else {
                editor.activeFile = null;
                editor.showEmptyState();
            }
            
            // Close modal
            editor.closeModal('importModal');
            
            // Show success message
            console.log('✅ Import completed successfully');
            const statusLeft = document.getElementById('statusLeft');
            if (statusLeft) {
                const importDate = backupData.exportDate ? 
                    new Date(backupData.exportDate).toLocaleString() : 'Unknown';
                statusLeft.textContent = `Import successful! Backup from: ${importDate}`;
                setTimeout(() => {
                    editor.updateStatus();
                }, 5000);
            }
            
            alert(`Import completed successfully!\\n\\n` +
                  `Files restored: ${Object.keys(editor.files).length}\\n` +
                  `Folders restored: ${Object.keys(editor.folders).length}\\n` +
                  `Backup date: ${backupData.exportDate ? new Date(backupData.exportDate).toLocaleString() : 'Unknown'}`);
            
        } catch (error) {
            console.error('❌ Import failed:', error);
            alert(`Import failed: ${error.message}\\n\\nPlease make sure you selected a valid backup file.`);
        }
    };
    
    reader.onerror = function() {
        console.error('❌ Failed to read backup file');
        alert('Failed to read the backup file. Please try again.');
    };
    
    reader.readAsText(file);
}