export interface TextItem {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface TextBlock {
    text: string;
    items: TextItem[];
    x: number;
    y: number;
    w: number;
    h: number;
}

const X_TOLERANCE = 5; // Tolerance for horizontal proximity
const Y_TOLERANCE = 3; // Tolerance for vertical proximity (same line)

export function clusterTextItems(items: TextItem[]): TextBlock[] {
    if (items.length === 0) return [];

    // Sort items primarily by Y (top to bottom) and then by X (left to right)
    // Note: PDF coordinates often have Y=0 at bottom, but we'll assume processed coords
    const sortedItems = [...items].sort((a, b) => {
        if (Math.abs(a.y - b.y) > Y_TOLERANCE) {
            return b.y - a.y; // Higher Y first (assuming Y is from bottom up or we normalized)
        }
        return a.x - b.x;
    });

    const blocks: TextBlock[] = [];
    let currentBlock: TextBlock | null = null;

    for (const item of sortedItems) {
        if (!currentBlock) {
            currentBlock = createBlock(item);
            continue;
        }

        const isSameLine = Math.abs(item.y - currentBlock.y) <= Y_TOLERANCE;
        const isNearbyX = item.x - (currentBlock.x + currentBlock.w) <= X_TOLERANCE;

        if (isSameLine && isNearbyX) {
            currentBlock.text += (currentBlock.text.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
            currentBlock.items.push(item);
            currentBlock.w = Math.max(currentBlock.w, item.x + item.w - currentBlock.x);
            currentBlock.h = Math.max(currentBlock.h, item.h);
        } else {
            blocks.push(currentBlock);
            currentBlock = createBlock(item);
        }
    }

    if (currentBlock) {
        blocks.push(currentBlock);
    }

    return blocks;
}

function createBlock(item: TextItem): TextBlock {
    return {
        text: item.str,
        items: [item],
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
    };
}
