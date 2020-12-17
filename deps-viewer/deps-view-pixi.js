class ViewSettings {
	arrows
	constructor() {
		this.node = {
			color: 0x008040,
			colorSelected: 0x808040,
			collapseButton: {
				size: 10,
				colorExpanded: 0x0000c0,
				colorCollapsed: 0xc00000
			},
			text: {
				position: {
					x: 15
				}
			},
			refCount: {
				padding: {
					right: 2
				}
			},
			interval: 10,
			padding: {
				left: 30,
				top: 25,
				right: 10,
				bottom: 10
			},
			leaf: {
				width: 200,
				height: 20
			}
		};
		this.layout = ["horizontal", "vertical"];
		this.arrow = {
			color: 0xffff00,
			alpha: 0.5
		};
	}
}

class PIXIView {
	#settings
	#parentContainer
	#container
	#pixiNodeList
	#dd
	#font
	constructor(parentContainer, depsData, settings) {
		this.#settings = settings ?? new ViewSettings();
		this.#parentContainer = parentContainer;
		this.#container = new PIXI.Container();
		this.#pixiNodeList = [];
        this.#dd = depsData;
        
		this.#parentContainer.addChild(this.#container);

		this.#font = new PIXI.TextStyle({
			fontFamily: "Arial",
			fontSize: 16,
			fill: "white",
			stroke: '#ffffff',
			strokeThickness: 0,
			align : 'center',
		});
	}

	refresh = () => {
		this.#container.removeChildren();

		const depth = 0;
		const layout = this.#getLayout(depth);

		for (let i = 0; i < this.#dd.roots.length; i++) {
			const createdObject = this.#createTree(this.#dd.roots[i], depth + 1);
			layout.add(createdObject);
			const pos = layout.getPos(i);
			createdObject.x = pos.x;
			createdObject.y = pos.y;
			this.#container.addChild(createdObject);
		};

		this.#createArrows(this.#dd.getArrowList());
	}

	#getLayout = (depth) => {
		const type = this.#settings.layout[depth] ?? this.#settings.layout[this.#settings.layout.length - 1];
		if (type === "horizontal") {
			return new HorizontalLayout(this.#settings.node.padding, this.#settings.node.interval);
		} else if (type === "vertical") {
			return new VerticalLayout(this.#settings.node.padding, this.#settings.node.interval);
		} else {
			return new VerticalLayout(this.#settings.node.padding, this.#settings.node.interval);
		}
	}
	
	#createTree = (data, currentDepth) => {
		const dataNodes = data.nodes;
		let createdObject;

		if (dataNodes.length == 0) {
			createdObject = this.#createLeaf(data);
		} else {
			const children = data.collapsed ? [] : dataNodes;
			children.forEach(d => {
				this.#createTree(d, currentDepth + 1);
			});
			createdObject = this.#createInternalNode(data, children, currentDepth);
		}
		const id = data.id;
		this.#pixiNodeList[id] = createdObject;
		return createdObject;
	}

	#createLeaf = (data) => {
		const id = data.id;
		const newNode = this.#createRectangle(
			this.#settings.node.leaf.width,
			this.#settings.node.leaf.height,
			this.#dd.isSelected(id) ? this.#settings.node.colorSelected : this.#settings.node.color);
		newNode.id = id;
		newNode.interactive = true;
		const onSelect = (ev) => {
			ev.stopPropagation();
			this.#dd.selectOrUnselect(newNode.id);
			this.#dd.refresh();
            this.refresh();
		}
		newNode.on('pointerdown', onSelect);

		const text = this.#createText(data.name);
		text.x = this.#settings.node.text.position.x;
		newNode.addChild(text);

		const depsInOutText = this.#createText(
			this.#toDepsText(data.depsFrom.arrowCount, data.deps.arrowCount));
		depsInOutText.x = this.#settings.node.leaf.width - depsInOutText.width - this.#settings.node.refCount.padding.right;
		newNode.addChild(depsInOutText);
		
		return newNode;
	}

	#createInternalNode = (data, dataNodes, depth) => {
		const layout = this.#getLayout(depth);
		dataNodes.forEach(d => {
			layout.add(this.#pixiNodeList[d.id]);
		});

		const id = data.id;
		const size = layout.getSize();
		const newNode = this.#createRectangle(
			Math.max(size.width, this.#settings.node.leaf.width),
			size.height,
			this.#dd.isSelected(id) ? this.#settings.node.colorSelected : this.#settings.node.color);
		newNode.id = id;
		newNode.interactive = true;
		newNode.on('pointerdown', ev => {
			ev.stopPropagation();
			this.#dd.selectOrUnselect(newNode.id);
			this.#dd.refresh();
            this.refresh();
		});

		const text = this.#createText(data.name);
		text.x = this.#settings.node.text.position.x;
		newNode.addChild(text);

		const depsInOutText = this.#createText(
			this.#toDepsText(
				data.collapsed ? data.depsFrom.arrowCount : data.depsFrom.mergedRefs.length,
				data.collapsed ? data.deps.arrowCount : data.deps.mergedRefs.length));
		depsInOutText.x = newNode.width - depsInOutText.width - this.#settings.node.refCount.padding.right;
		newNode.addChild(depsInOutText);

		const collapseButton = this.#createRectangle(
			this.#settings.node.collapseButton.size,
			this.#settings.node.collapseButton.size,
			data.collapsed ? this.#settings.node.collapseButton.colorCollapsed : this.#settings.node.collapseButton.colorExpanded);
		collapseButton.interactive = true;
		collapseButton.on('pointerdown', ev => {
			ev.stopPropagation();
            this.#dd.toggleCollapsed(newNode.id);
            this.#dd.refresh();
            this.refresh();
		});
		newNode.addChild(collapseButton);

		for (let i = 0; i < dataNodes.length; i++) {
			const node = this.#pixiNodeList[dataNodes[i].id];
			const pos = layout.getPos(i);
			node.x = pos.x;
			node.y = pos.y;
			newNode.addChild(node);
		}

		return newNode;
	}

	#toDepsText = (depsIn, depsOut) => {
		return '' + (depsIn == 0 ? '-' : depsIn) + '/' + (depsOut == 0 ? '-' : depsOut); 
	}

	#createRectangle = (width, height, hexColorRgb) => {
		const container = new PIXI.Container();
		container.width  = width;
		container.height = height;

		const graphics = new PIXI.Graphics();
		graphics.beginFill(hexColorRgb);
		graphics.lineStyle(2, 0xffffff, 1);
		graphics.lineTo(width, 0);
		graphics.lineTo(width, height);
		graphics.lineTo(0, height);
		graphics.lineTo(0, 0);
		graphics.closePath();
		graphics.endFill();

		container.addChild(graphics);

		return container;
	}

	#createText = (text) => {
		return new PIXI.Text(text, this.#font);
	}

	#createArrows = (arrowList) => {
		arrowList.forEach(a => {
			const from = this.#pixiNodeList[a.from];
			const to = this.#pixiNodeList[a.to];

			if (this.#dd.areSiblings(a.from, a.to)) {
				this.#createNearArrow(from, to);
			} else {
				this.#createFarArrow(from, to);
			}
		});
	}

	#createFarArrow = (from, to) => {
		let posFrom = from.toGlobal(new PIXI.Point(10, from.height / 2));
		let posTo = to.toGlobal(new PIXI.Point(to.width / 2, to.height / 2));

		const g = new PIXI.Graphics();
		g.lineStyle(2, this.#settings.arrow.color, this.#settings.arrow.alpha);
		g.moveTo(posFrom.x, posFrom.y);
		g.lineTo(posTo.x, posTo.y);

		this.#drawArrowhead(g, posTo, {x:posTo.x - posFrom.x, y:posTo.y - posFrom.y});

		this.#container.addChild(g);
	}

	#createNearArrow = (from, to) => {
		let posFrom = from.toGlobal(new PIXI.Point(0, from.height / 2));
		let posTo = to.toGlobal(new PIXI.Point(0, to.height / 2));
		const centerX = posFrom.x + Math.abs(posFrom.y - posTo.y);
		const centerY = (posFrom.y + posTo.y) / 2;
		const radius = Math.sqrt((posFrom.x - centerX) ** 2 + (posFrom.y - centerY) ** 2);
		let startAngle = Math.PI * 0.85;
		let endAngle = Math.PI * 1.15;

		if (posFrom.y < posTo.y) {
			// swap
			const temp = startAngle;
			startAngle = endAngle;
			endAngle = temp;
		}

		const g = new PIXI.Graphics();
		g.lineStyle(2, this.#settings.arrow.color, this.#settings.arrow.alpha);
		g.arc(centerX, centerY, radius, startAngle, endAngle, posFrom.y < posTo.y);
		
		const points = g.currentPath.points
		const pointsLength = points.length;
		const p1 = {x:points[pointsLength - 2], y:points[pointsLength - 1]};
		const p2 = {x:points[pointsLength - 4], y:points[pointsLength - 3]};
		this.#drawArrowhead(g, p1, {x:p1.x - p2.x, y:p1.y - p2.y});

		this.#container.addChild(g);
	}

	#drawArrowhead = (graphics, point, vector) => {
		const headLength = 5;
		const vectorLength = Math.sqrt(vector.x ** 2 + vector.y ** 2);

		let dx = vector.x * headLength / vectorLength;
		let dy = vector.y * headLength / vectorLength;

		let ax = point.x - dx;
		let ay = point.y - dy;

		let a1x = ax + dy * 0.5;
		let a1y = ay - dx * 0.5;
		let a2x = ax - dy * 0.5;
		let a2y = ay + dx * 0.5;

		graphics.lineTo(a1x, a1y);
		graphics.lineTo(a2x, a2y);
		graphics.lineTo(point.x, point.y);
	}
}

class HorizontalLayout {
	#padding
	#interval
	#posArray
	#nextPos
	#largest
	constructor(padding, interval) {
		this.#padding = padding;
		this.#interval = interval;
		this.#posArray = [];
		this.#nextPos = { x: padding.left, y: padding.top };
		this.#largest = 0;
	}

	add = (obj) => {
		this.#posArray.push({ x: this.#nextPos.x, y: this.#nextPos.y });
		this.#nextPos.x += obj.width + this.#interval;
		if (this.#largest < obj.height) {
			this.#largest = obj.height;
		}
	}

	getSize = () => {
		return {
			width: this.#nextPos.x - this.#interval + this.#padding.right,
			height: this.#nextPos.y + this.#largest + this.#padding.bottom
		};
	}

	getPos = (index) => {
		return this.#posArray[index];
	}
}

class VerticalLayout {
	#padding
	#interval
	#posArray
	#nextPos
	#largest
	constructor(padding, interval) {
		this.#padding = padding;
		this.#interval = interval;
		this.#posArray = [];
		this.#nextPos = { x: padding.left, y: padding.top };
		this.#largest = 0;
	}

	add = (obj) => {
		this.#posArray.push({ x: this.#nextPos.x, y: this.#nextPos.y });
		this.#nextPos.y += obj.height + this.#interval;
		if (this.#largest < obj.width) {
			this.#largest = obj.width;
		}
	}

	getSize = () => {
		return {
			width: this.#nextPos.x + this.#largest + this.#padding.right,
			height: this.#nextPos.y - this.#interval + this.#padding.bottom
		};
	}

	getPos = (index) => {
		return this.#posArray[index];
	}
}
