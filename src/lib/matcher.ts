import ExcelJS from 'exceljs';
import https from 'https';

// 구글 시트 매칭데이터 URL (CSV 포맷)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VzyHFgij9ye8UGKCvZI1u-UgkfE_TMBcBl_DFFBe174/export?format=csv&gid=1734406793';

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지'],
    'BLUE': ['블루', '파랑'],
    'NAVY': ['네이비', '남색'],
    'RED': ['레드', '빨강'],
    'GREEN': ['그린', '초록'],
    'MINT': ['민트'],
    'PURPLE': ['퍼플', '보라'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색']
};

async function fetchCSV(url: string, hops = 0): Promise<string> {
    if (hops > 5) throw new Error('Too many redirects');
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchCSV(res.headers.location, hops + 1));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch CSV: ${res.statusCode}`));
                return;
            }
            const chunks: any[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const fullBuffer = Buffer.concat(chunks);
                resolve(fullBuffer.toString('utf8'));
            });
        }).on('error', (err) => reject(err));
    });
}

function parseCSV(text: string) {
    let result: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let field = '';
    for (let c of text) {
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { row.push(field); field = ''; }
        else if ((c === '\n' || c === '\r') && !inQuotes) {
            if (c === '\r') continue;
            row.push(field); result.push(row); row = []; field = '';
        } else field += c;
    }
    if (field !== '') row.push(field);
    if (row.length > 0) result.push(row);
    return result;
}

function normalizeStr(s: any) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function normalizeColor(c: any) {
    if (!c) return "";
    return c.toString().trim().toUpperCase();
}

function getSimilarity(s1: string, s2: string) {
    if (!s1 || !s2) return 0;
    s1 = s1.toLowerCase().replace(/\s+/g, '');
    s2 = s2.toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1.0;
    const pairs1 = getBigrams(s1), pairs2 = getBigrams(s2);
    const union = pairs1.length + pairs2.length;
    let hit = 0;
    for (const x of pairs1) { for (const y of pairs2) { if (x === y) hit++; } }
    return hit > 0 ? (2.0 * hit) / union : 0;
}

function getBigrams(str: string) {
    const pairs = [];
    for (let i = 0; i < str.length - 1; i++) pairs.push(str.substring(i, i + 2));
    return pairs;
}
// ... (상단 skip)

export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
const workbook = new ExcelJS.Workbook();
@@ -102,7 +9,8 @@ export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook
sheet.eachRow((row, rowNumber) => {
if (rowNumber === 1) return;
const styleNo = row.getCell(1).text.trim();
        if (!styleNo || styleNo === '총 합계') return;
        // [수정] '합계'가 포함된 행은 매칭에서 제외하도록 보강
        if (!styleNo || styleNo.includes('합계')) return; 
excelRecords.push({
styleNo: styleNo,
pdfName: row.getCell(2).text.trim(),
@@ -112,99 +20,45 @@ export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook
});
});

    const csvText = await fetchCSV(SHEET_URL);
    const csvData = parseCSV(csvText);
    const sheetRecords: any[] = [];
    for(let i = 1; i < csvData.length; i++) {
        const r = csvData[i];
        if (r.length >= 3) {
            sheetRecords.push({
                productCode: r[0]?.trim() || '',
                productName: r[1]?.trim() || '',
                option: r[2]?.trim() || '',
                styleNo: r[3]?.trim() || '',
                normStyle: normalizeStr(r[3])
            });
        }
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        if (!ex.styleNo) return;
        const exNormStyle = normalizeStr(ex.styleNo);
        let matches = sheetRecords.filter(s => s.normStyle === exNormStyle || s.styleNo === ex.styleNo);
        if (matches.length === 0) {
            matches = sheetRecords.filter(s => s.productName.toUpperCase().includes(exNormStyle));
        }

        let bestMatch: any = null, bestScore = -1;
        if (matches.length > 0) {
            const exColor = normalizeColor(ex.color);
            const koColors = COLOR_MAP[exColor] || [];
            for(let m of matches) {
                let score = 0;
                const opt = m.option.replace(/\s+/g, '').toUpperCase();
                if (ex.size) {
                    const normSize = ex.size.replace(/\s+/g, '').toUpperCase();
                    if (opt.includes(`:${normSize}`) || opt === normSize) score += 20;
                    else if (opt.includes(normSize)) score += 10;
                }
                if (ex.color && opt.includes(ex.color.replace(/\s+/g, '').toUpperCase())) score += 10;
                else { for(let syn of koColors) { if (opt.toUpperCase().includes(syn.replace(/\s+/g, ''))) { score += 10; break; } } }
                if (m.styleNo.toUpperCase() === ex.styleNo.toUpperCase()) score += 30;
                const sim = getSimilarity(ex.pdfName, m.productName);
                if (sim >= 0.7) score += (sim * 15);
                if (score > bestScore) { bestScore = score; bestMatch = m; }
            }
        }
        
        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestMatch && bestScore >= 25) {
            matchedRaw.push({
                productCode: bestMatch.productCode,
                sheetName: bestMatch.productName,
                sheetOption: bestMatch.option,
                qty: ex.qty,
                originalKey: originalKey
            });
        } else {
            matchedRaw.push({
                productCode: '실패',
                sheetName: `(미매칭) ${ex.pdfName}`,
                sheetOption: `${ex.color}, ${ex.size}`,
                qty: ex.qty,
                originalKey: originalKey
            });
        }
    });
    // ... (매칭 로직은 그대로 유지)

    const aggregated: Record<string, any> = {};
    matchedRaw.forEach(item => {
        const key = `${item.productCode}|${item.sheetName}|${item.sheetOption}`;
        if (aggregated[key]) {
            aggregated[key].qty += item.qty;
            if (!aggregated[key].originalKeys) aggregated[key].originalKeys = [];
            aggregated[key].originalKeys.push(item.originalKey);
        } else {
            aggregated[key] = { ...item, originalKeys: [item.originalKey] };
        }
    });
    // [수정] 텍스트를 '미매칭'으로 통일 (스크린샷 기준)
    if (bestMatch && bestScore >= 25) {
        matchedRaw.push({
            productCode: bestMatch.productCode,
            sheetName: bestMatch.productName,
            sheetOption: bestMatch.option,
            qty: ex.qty,
            originalKey: originalKey
        });
    } else {
        matchedRaw.push({
            productCode: '미매칭', 
            sheetName: `(미매칭) ${ex.pdfName}`,
            sheetOption: `${ex.color} / ${ex.size}`,
            qty: ex.qty,
            originalKey: originalKey
        });
    }

    const finalResults = Object.values(aggregated).sort((a,b) => {
        if (a.productCode === '실패' && b.productCode !== '실패') return 1;
        if (a.productCode !== '실패' && b.productCode === '실패') return -1;
        return a.sheetName.localeCompare(b.sheetName);
    });
    // ... (중간 aggregation 로직 그대로 유지)

const outWb = new ExcelJS.Workbook();
const outWs = outWb.addWorksheet('매칭결과');

    // [추가] 오늘 날짜 메모 (예: 260401_인도 입고)
    const today = new Date();
    const memoDate = today.toISOString().slice(2, 10).replace(/-/g, '');
    const memoContent = `${memoDate}_인도 입고`;

    // [수정] 컬럼 설정: E열 이름을 Original_Keys로 변경하고 F열(메모) 추가
outWs.columns = [
{ header: '상품코드', key: 'productCode', width: 20 },
{ header: '상품명', key: 'sheetName', width: 40 },
{ header: '옵션', key: 'sheetOption', width: 30 },
{ header: '작업수량', key: 'qty', width: 15 },
        { header: '숨김식별키', key: 'originalKeys', width: 0 } 
        { header: 'Original_Keys', key: 'originalKeys', width: 35 }, // 숨김식별키 -> Original_Keys
        { header: '메모', key: 'memo', width: 25 }                  // 메모 컬럼 추가
];

outWs.getRow(1).font = { bold: true };
@@ -216,14 +70,16 @@ export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook
sheetName: r.sheetName,
sheetOption: r.sheetOption,
qty: r.qty,
            originalKeys: r.originalKeys.join(';') 
            originalKeys: r.originalKeys.join(';'),
            memo: memoContent // [추가] 메모 데이터 입력
});
        if (r.productCode === '실패') {
        if (r.productCode === '미매칭') {
row.eachCell(c => { c.font = { color: { argb: 'FFFF0000' } }; });
}
});

    outWs.getColumn(5).hidden = true;
    // [수정] 5번째 컬럼 숨기기 로직 삭제 (표시되도록)
    // outWs.getColumn(5).hidden = true; 

outWs.eachRow(row => {
row.eachCell(cell => {
