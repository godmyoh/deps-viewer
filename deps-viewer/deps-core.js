class DepsData {
    #dataNodeList
    #arrowList
    #arrowSet
    #roots
    #idSelected
    constructor(depsData) {
        this.#dataNodeList = [];
        this.#arrowList = [];
        this.#arrowSet = new Set();
        this.#roots = [];
        this.#idSelected = null;
        this.#importArray(depsData);
        this.#calcDeps();
    }

    refresh = () => {
        this.#clearArrows();

        if (this.#idSelected === null) {
            this.#roots.forEach(d => {
                this.#createArrowDataUnder(d);
            });
        } else {
            this.#createArrowDataBidirectionallyUnder(this.#dataNodeList[this.#idSelected]);
        }
    }

    get roots() {
        return this.#roots;
    }

    getData = (id) => {
        return this.#dataNodeList[id];
    }

    getArrowList = () => {
        return this.#arrowList;
    }

    toggleCollapsed = (id) => {
        this.#dataNodeList[id].collapsed = !this.#dataNodeList[id].collapsed;
    }

    areSiblings = (id1, id2) => {
        return this.#dataNodeList[id1].parent === this.#dataNodeList[id2].parent
    }

    selectOrUnselect = (id) => {
        if (this.#idSelected === id) {
            this.#idSelected = null;
        } else {
            this.#idSelected = id;
        }
    }

    isSelected = (id) => {
        return this.#idSelected === id;
    }

    #importArray = (dataArray) => {
        dataArray.forEach(d => {
            this.#import(d, null);
            this.#roots.push(this.getData(d.id));
        });
    }

    #import = (data, parent) => {
        const importedData = {
            id: data.id,
            name: data.name,
            nodes: [],
            parent: parent,
            collapsed: false,
            deps: {
                refs: [...(data.deps ?? [])],
                mergedRefs: [],
                arrowCount: 0
            },
            depsFrom: {
                refs: [],
                mergedRefs: [],
                arrowCount: 0
            }
        };

        (data.nodes ?? []).forEach(d => {
            this.#import(d, importedData);
            importedData.nodes.push(this.#dataNodeList[d.id]);
        });
    
        this.#dataNodeList[importedData.id] = importedData;
    }

    #calcDeps = () => {
        this.#fillDepsFrom();
        this.#roots.forEach(d => {
            this.#mergeDeps(d, (d) => d.deps);
            this.#mergeDeps(d, (d) => d.depsFrom);
        });
    }

    #fillDepsFrom = () => {
        this.#dataNodeList.forEach(data => {
            if (data === undefined) {
                return;
            }
            data.deps.refs.forEach(dep => {
                const destination = this.#dataNodeList[dep];
                destination.depsFrom.refs.push(data.id);
            });
        });
    }

    #mergeDeps = (data, funcGetDeps) => {
        const depsObject = funcGetDeps(data);
        const merged = new Set(depsObject.refs);

        data.nodes.forEach(d => {
            this.#mergeDeps(d, funcGetDeps);
            funcGetDeps(d).mergedRefs.forEach(dep => {
                merged.add(dep);
            });
        });

        for (let d of merged.values()) {
            if (this.#isDescendantOf(data.id, d)) {
                merged.delete(d);
            }
        };
        
        depsObject.mergedRefs = Array.from(merged);
    }
    
    #clearArrows = () => {
        this.#dataNodeList.forEach(d => {
            if (d !== undefined) {
                d.deps.arrowCount = 0;
                d.depsFrom.arrowCount = 0;
            }
        });
        this.#arrowList = [];
        this.#arrowSet.clear();
    }

    #createArrowData = (fromId, toId) => {
        const from = this.#findCollapsedAncestorOrSelf(this.#dataNodeList[fromId]);
        const to = this.#findCollapsedAncestorOrSelf(this.#dataNodeList[toId]);
    
        if (from.id === to.id) {
            return;
        }
    
        const arrowKey = '' + from.id + '_' + to.id;
        if (this.#arrowSet.has(arrowKey)) {
            return;
        } else {
            this.#arrowSet.add(arrowKey);
            from.deps.arrowCount++;
            to.depsFrom.arrowCount++;
        }

        this.#arrowList.push({ from:from.id, to:to.id });
    }
    
    #createArrowDataUnder = (nodeData) => {
        const id = nodeData.id;
    
        if (nodeData.collapsed) {
            nodeData.deps.mergedRefs.forEach(dep => {
                this.#createArrowData(id, dep);
            });
        } else {
            nodeData.nodes.forEach(d => {
                this.#createArrowDataUnder(d);
            });
            nodeData.deps.refs.forEach(dep => {
                this.#createArrowData(id, dep);
            });
        }
    }

    #createArrowDataBidirectionallyUnder = (nodeData) => {
        const id = nodeData.id;
    
        if (nodeData.collapsed) {
            nodeData.deps.mergedRefs.forEach(dep => {
                this.#createArrowData(id, dep);
            });
            nodeData.depsFrom.mergedRefs.forEach(depFrom => {
                this.#createArrowData(depFrom, id);
            });
        } else {
            nodeData.nodes.forEach(d => {
                this.#createArrowDataBidirectionallyUnder(d);
            });
            nodeData.deps.refs.forEach(dep => {
                this.#createArrowData(id, dep);
            });
            nodeData.depsFrom.refs.forEach(depFrom => {
                this.#createArrowData(depFrom, id);
            });
        }
    }
    
    #isDescendantOf = (ancestorId, dataId) => {
        let current = this.#dataNodeList[dataId];
        while (true) {
            const parent = current.parent;
            if (parent === null) {
                return false;
            }
            if (parent.id === ancestorId) {
                return true;
            }
            current = parent;
        }
    }
    
    #findCollapsedAncestor = (nodeData) => {
        let collapsedAncestor = null;
        let ancestor = nodeData;
        while (ancestor !== null) {
            if (ancestor.collapsed) {
                collapsedAncestor = ancestor;
            }
            ancestor = ancestor.parent;
        }
        
        return collapsedAncestor;
    }

    #findCollapsedAncestorOrSelf = (nodeData) => {
        let collapsedAncestor = this.#findCollapsedAncestor(nodeData);
        if (collapsedAncestor !== null) {
            return collapsedAncestor;
        } else {
            return nodeData;
        }
    }
}
