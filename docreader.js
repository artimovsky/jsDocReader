class jsDocReader {

    vendorUrls = {
        "pdf":{
            "s1":"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js",
            "s2":"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js",
        }
    }

    cssPrefix = 'docreader';

    DOM = {
        'root':null,
        'canvas':null,
        'image':null,
        'closeDoc':null,
        'nextDoc':null,
        'prevDoc':null,
        'toolbar':null,
        'prevPage':null,
        'nextPage':null,
        'currentPage':null,
        'totalPages':null,
        'zoomOut':null,
        'zoomIn':null,
        'zoomAmount':null,
    };

    docsList = [];
    currentDoc = null;
    pendingDoc = null;
    docgroup = 0;

    modalMode = true;
    sourceUrl = null;
    isImage = false;
    isPDF = false;
    pdfDocument = null;
    imageDocument = null;
    canvasContext = null;

    zoom = 1;
    minZoom = 1;
    maxZoom = 3;
    pendingPage = 0;
    currentPage = 1;
    totalPages = null;
    

    constructor(selector, rootContainerId = null) {

        if (rootContainerId !== null) {
            this.DOM.root = document.getElementById(rootContainerId);
            this.modalMode = false;
        } else {
            this.DOM.root = this.buildRootContainer();
        }

        this.attachVendor();
        this.attachCSS();
        this.build();
        this.setControllers();
        this.attachOnClickListener(selector);
    }

    attachOnClickListener(selector) {
        
        const _this = this;
        const elements = document.querySelectorAll(selector);
        let docgroup;
        
        elements.forEach(function(element, i, elements){

            docgroup = 0;
            if (element.dataset.drgroup !== undefined) {
                docgroup = element.dataset.drgroup;
            }

            if (_this.docsList[docgroup] === undefined) {
                _this.docsList[docgroup] = [];
            }
            _this.docsList[docgroup].push(element);

            element.addEventListener('click', (e) => {
                e.preventDefault();

                docgroup = 0;
                if (e.target.dataset.drgroup !== undefined) {
                    docgroup = e.target.dataset.drgroup;
                }
                _this.docgroup = docgroup;
                _this.clear();

                _this.docsList[docgroup].forEach((a, j, aa) => {
                    if (a.href === e.target.href) {
                        _this.currentDoc = j;
                    }
                });
                

                _this.openDoc(e.target.href);

            });
        });
    }

    openDoc(sourceUrl) {

        const _this = this;

        _this.sourceUrl = sourceUrl;
        _this.pendingDoc = sourceUrl;
        _this.pendingPage = 1;
        _this.zoom = 1;

        let loadSourcePromise = _this.loadSource();

        _this.DOM.root.style.display = 'unset';

        loadSourcePromise.then(function (obj) {
            if (_this.isPDF) {
                _this.pdfDocument = obj;
                _this.totalPages = _this.pdfDocument.numPages;
                _this.DOM.totalPages.textContent = _this.totalPages;
                _this.pdfRender();
            } else if (_this.isImage) {
                _this.imageDocument = obj;
                _this.imageRender();
            }
        }).catch(function (reason) {
            _this.pendingDoc = null;
            console.error("Error: " + reason);
        });

    }

    nextDoc() {
        if (this.pendingDoc !== null) return;

        if (this.docsList[this.docgroup][this.currentDoc + 1] != undefined) {
            this.clear();
            this.currentDoc++;
            const currentDoc = this.docsList[this.docgroup][this.currentDoc];
            this.openDoc(currentDoc.href);
            return;
        }
    }

    prevDoc() {
        if (this.pendingDoc !== null) return;

        if (this.docsList[this.docgroup][this.currentDoc - 1] != undefined) {
            this.clear();
            this.currentDoc--;
            const currentDoc = this.docsList[this.docgroup][this.currentDoc];
            this.openDoc(currentDoc.href);
            return;
        }
    }

    pdfRender() {

        const _this = this;

        return _this.pdfDocument.getPage(_this.pendingPage).then(function (pdfPage) {
            const viewport = pdfPage.getViewport({ scale: _this.zoom });
            
            _this.DOM.canvas.width = viewport.width;
            _this.DOM.canvas.height = viewport.height;
            const renderTask = pdfPage.render({
                canvasContext: _this.canvasContext,
                viewport,
            });

            renderTask.promise.then(() => {
                _this.currentPage = _this.pendingPage;
                _this.pendingPage = 0;
                _this.pendingDoc = null;
                _this.DOM.currentPage.textContent = _this.currentPage;

                _this.DOM.canvas.style.display = 'unset';
                _this.DOM.toolbar.style.display = 'unset';
            });

            return;
        });
    }

    imageRender() {

        const _this = this;

        _this.DOM.image.src = URL.createObjectURL(_this.imageDocument);

        _this.pendingDoc = null;

        _this.DOM.image.style.display = 'unset';

        return;
    }

    async loadSource() {

        this.isPDF = false;
        this.isImage = false;

        const response = await fetch(this.sourceUrl);
        const ab = await response.arrayBuffer();
        const arr = new Uint8Array(ab).subarray(0, 4);;
        let header = '';
        for (let i = 0; i < arr.length; i++) {
            header += arr[i].toString(16);
        }

        if (header === '25504446') {

            this.isPDF = true;
            const loadingTask = pdfjsLib.getDocument(this.sourceUrl);

            return loadingTask.promise;

        } else if ((header === '89504e47') || (header === 'ffd8ffe0') || (header === 'ffd8ffe1') || (header === 'ffd8ffe2')) {
            
            // 89504e47 - это PNG
            // ffd8ffe0 || ffd8ffe1 || ffd8ffe2 - это JPG
            
            this.isImage = true;
            
            const promise = new Promise(function(resolve, reject) {
                resolve(new Blob([ab]));
            });

            return promise;

        }

    }

    build() {

        // Viewport
        const viewport = document.createElement('div');
        viewport.className = this.cssPrefix + '-viewport';
        this.DOM.root.append(viewport);

        // Preloader
        const preloader = document.createElement('figure');
        preloader.className = this.cssPrefix + '-preloader';
        viewport.append(preloader);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.className = this.cssPrefix + '-canvas';
        viewport.append(canvas);

        this.DOM.canvas = canvas;
        this.canvasContext = canvas.getContext('2d');

        // Image
        const image = document.createElement('img');
        image.className = this.cssPrefix + '-image';
        viewport.append(image);
        this.DOM.image = image;

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = this.cssPrefix + '-toolbar';
        this.DOM.root.append(toolbar);
        this.DOM.toolbar = toolbar;

        // Toolbar / PrevPageButton
        const prevPageBtn = document.createElement('button');
        prevPageBtn.className = 'prev-page-btn';
        toolbar.append(prevPageBtn);
        this.DOM.prevPage = prevPageBtn;

        // Toolbar / PrevPageButton / Icon
        let icon = document.createElement('div');
        icon.className = 'icon';
        prevPageBtn.append(icon);

        // Toolbar / Pages
        const pages = document.createElement('div');
        pages.className = 'pages';
        toolbar.append(pages);

        // Toolbar / Pages / CurrentPage
        const currentPageCnt = document.createElement('div');
        currentPageCnt.className = 'current-page';
        pages.append(currentPageCnt);
        this.DOM.currentPage = currentPageCnt;

        // Toolbar / Pages / Separator
        const separator = document.createElement('div');
        separator.className = 'separator';
        separator.innerText = '/';
        pages.append(separator);

        // Toolbar / Pages / TotalPages
        const totalPagesCnt = document.createElement('div');
        totalPagesCnt.className = 'total-pages';
        pages.append(totalPagesCnt);
        this.DOM.totalPages = totalPagesCnt;

        // Toolbar / NextPageButton
        const nextPageBtn = document.createElement('button');
        nextPageBtn.className = 'next-page-btn';
        toolbar.append(nextPageBtn);
        this.DOM.nextPage = nextPageBtn;

        // Toolbar / NextPageButton / Icon
        icon = document.createElement('div');
        icon.className = 'icon';
        nextPageBtn.append(icon);


        // Toolbar / ZoomOutBtn
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'zoom-out-btn';
        toolbar.append(zoomOutBtn);
        this.DOM.zoomOut = zoomOutBtn;

        // Toolbar / ZoomOutBtn / Icon
        icon = document.createElement('div');
        icon.className = 'icon';
        zoomOutBtn.append(icon);


        // Toolbar / Scale
        const zoomCnt = document.createElement('div');
        zoomCnt.className = 'scale-amount';
        toolbar.append(zoomCnt);
        this.DOM.zoomAmount = zoomCnt;

        // Toolbar / ZoomInBtn
        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'zoom-in-btn';
        toolbar.append(zoomInBtn);
        this.DOM.zoomIn = zoomInBtn;

        // Toolbar / ZoomInBtn / Icon
        icon = document.createElement('div');
        icon.className = 'icon';
        zoomInBtn.append(icon);


        if (this.modalMode === true) {

            // CloseDocBtn (for ModalMode)
            const closeDocBtn = document.createElement('button');
            closeDocBtn.className = 'close-doc-btn';
            closeDocBtn.title = 'Закрыть';
            this.DOM.root.append(closeDocBtn);
            this.DOM.closeDoc = closeDocBtn;


            // NextDocBtn (for ModalMode)
            const nextDocBtn = document.createElement('button');
            nextDocBtn.className = 'next-doc-btn';
            nextDocBtn.title = 'Далее';
            this.DOM.root.append(nextDocBtn);
            this.DOM.nextDoc = nextDocBtn;


            // PrevDocBtn (for ModalMode)
            const prevDocBtn = document.createElement('button');
            prevDocBtn.className = 'prev-doc-btn';
            prevDocBtn.title = 'Назад';
            this.DOM.root.append(prevDocBtn);
            this.DOM.prevDoc = prevDocBtn;

        }

    }

    setControllers() {

        const _this = this;

        _this.DOM.prevPage.addEventListener('click', () => {
            if (_this.pendingPage === 0) {
                if (_this.currentPage > 1) {
                    _this.pendingPage = _this.currentPage - 1;
                    _this.pdfRender();
                }
            }
        });

        _this.DOM.nextPage.addEventListener('click', () => {
            if (_this.pendingPage === 0) {
                if (_this.currentPage < _this.totalPages) {
                    _this.pendingPage = _this.currentPage + 1;
                    _this.pdfRender();
                }
            }
        });

        _this.DOM.zoomOut.addEventListener('click', () => {
            if (_this.pendingPage === 0) {
                if (_this.zoom > _this.minZoom) {
                    _this.zoom = _this.zoom - 0.5;
                    _this.pendingPage = _this.currentPage;
                    _this.pdfRender();
                }
            }
        });

        _this.DOM.zoomIn.addEventListener('click', () => {
            if (_this.pendingPage === 0) {
                if (_this.zoom < _this.maxZoom) {
                    _this.zoom = _this.zoom + 0.5;
                    _this.pendingPage = _this.currentPage;
                    _this.pdfRender();
                }
            }
        });


        if (_this.modalMode === true) {
            _this.DOM.closeDoc.addEventListener('click', () => {
                _this.closeDoc();
            });
            _this.DOM.nextDoc.addEventListener('click', () => {
                _this.nextDoc();
            });
            _this.DOM.prevDoc.addEventListener('click', () => {
                _this.prevDoc();
            });
        }

    }

    buildRootContainer() {

        // Root container
        const rootCnt = document.createElement('div');
        rootCnt.className = this.cssPrefix + '-root-modal';
        document.body.append(rootCnt);

        return rootCnt;

    }

    clear() {

        this.DOM.canvas.width = 1;
        this.DOM.canvas.height = 1;
        this.canvasContext.clearRect(0, 0, this.DOM.canvas.width, this.DOM.canvas.height);
        this.DOM.image.src = '';

        this.DOM.canvas.style.display = 'none';
        this.DOM.toolbar.style.display = 'none';
        this.DOM.image.style.display = 'none';

    }

    closeDoc() {
        this.clear();
        this.DOM.root.style.display = 'none';
    }

    attachCSS() {
        const css = document.createElement('link');
        css.href = '/css/doc-reader.css';
        css.rel = 'stylesheet';
        document.head.append(css);
    }

    attachVendor() {
        const script = document.createElement('script');
        script.src = this.vendorUrls['pdf']['s1'];
        document.head.append(script);
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = this.vendorUrls['pdf']['s2'];
        };
    }



}