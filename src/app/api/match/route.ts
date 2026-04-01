import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

// 구글 시트 마스터 데이터 가져오기 (CSV URL)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1XasInVIdj_yZ6sHh6c7D8D6eE8I89w7L_5U3H8q4o7U/export?format=csv&gid=0";

async function fetchMasterData() {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();
    const rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    return rows.slice(1); // 헤더 제외
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('excel') as File;
    if (!file) return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sourceSheet = workbook.worksheets[0];
    
    // 마스터 데이터 로드
    const masterData = await fetchMasterData();
    
    // 결과 전용 새 엑셀 생성
    const resultWorkbook = new ExcelJS.Workbook();
    const resultSheet = resultWorkbook.addWorksheet('Matched_Result');
    
    // 1. 헤더 설정 (F열에 '메모' 추가)
    resultSheet.addRow(['상품코드', '상품명', '옵션', '작업수량', 'Original_Keys', '메모']);
    
    // 헤더 디자인
    const headerRow = resultSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF444444' } };
    headerRow.alignment = { horizontal: 'center' };

    // 2. 오늘 날짜 포맷 (예: 260401_인도 입고)
    const now = new Date();
    const yy = String(now.getYear() + 1900).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const memoContent = `${yy}${mm}${dd}_인도 입고`;

    // 3. 매칭 로직
    const matchedData: any = {};
    sourceSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const style = row.getCell(1).text.trim();
        const name = row.getCell(2).text.trim();
        const color = row.getCell(3).text.trim();
        const size = row.getCell(4).text.trim();
        const qty = parseInt(row.getCell(5).text) || 0;
        
        if (!style) return;

        let found = masterData.find(m => m[1].includes(style) && m[2].includes(color) && m[2].includes(size));
        if (!found) found = masterData.find(m => m[1].includes(style));

        const pCode = found ? found[0] : '미매칭';
        const pName = found ? found[1] : name;
        const pOption = found ? found[2] : `${color} / ${size}`;
        const key = `${pCode}|${pName}|${pOption}`;

        if (!matchedData[key]) {
            matchedData[key] = { pCode, pName, pOption, qty: 0, originalKeys: [] };
        }
        matchedData[key].qty += qty;
        matchedData[key].originalKeys.push(`${style}|${name}|${color}|${size}`);
    });

    // 4. 데이터 쓰기 (메모 열 추가)
    Object.values(matchedData).forEach((d: any) => {
        const row = resultSheet.addRow([
            d.pCode, 
            d.pName, 
            d.pOption, 
            d.qty, 
            d.originalKeys.join(';'),
            memoContent // ✨ F열 메모 데이터
        ]);
        row.alignment = { horizontal: 'center' };
    });

    // 열 너비 조절
    resultSheet.columns = [
        { width: 15 }, { width: 40 }, { width: 30 }, { width: 15 }, { width: 40 }, { width: 25 }
    ];

    const outBuffer = await resultWorkbook.xlsx.writeBuffer();
    return new NextResponse(outBuffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename=Matched_Result.xlsx`
        }
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
