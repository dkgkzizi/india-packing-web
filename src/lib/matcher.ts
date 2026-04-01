// ... (상단 skip)

export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    
    const excelRecords: any[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const styleNo = row.getCell(1).text.trim();
        // [수정] '합계'가 포함된 행은 매칭에서 제외하도록 보강
        if (!styleNo || styleNo.includes('합계')) return; 
        excelRecords.push({
            styleNo: styleNo,
            pdfName: row.getCell(2).text.trim(),
            color: row.getCell(3).text.trim(),
            size: row.getCell(4).text.trim(),
            qty: parseInt(row.getCell(5).value as any) || 0
        });
    });

    // ... (매칭 로직은 그대로 유지)

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
        { header: 'Original_Keys', key: 'originalKeys', width: 35 }, // 숨김식별키 -> Original_Keys
        { header: '메모', key: 'memo', width: 25 }                  // 메모 컬럼 추가
    ];

    outWs.getRow(1).font = { bold: true };
    outWs.getRow(1).alignment = { horizontal: 'center' };
    
    finalResults.forEach(r => {
        const row = outWs.addRow({
            productCode: r.productCode,
            sheetName: r.sheetName,
            sheetOption: r.sheetOption,
            qty: r.qty,
            originalKeys: r.originalKeys.join(';'),
            memo: memoContent // [추가] 메모 데이터 입력
        });
        if (r.productCode === '미매칭') {
            row.eachCell(c => { c.font = { color: { argb: 'FFFF0000' } }; });
        }
    });

    // [수정] 5번째 컬럼 숨기기 로직 삭제 (표시되도록)
    // outWs.getColumn(5).hidden = true; 

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin' as any}, left: {style:'thin' as any}, bottom: {style:'thin' as any}, right: {style:'thin' as any} };
            cell.alignment = { horizontal: 'center' as any, vertical: 'middle' as any };
        });
    });

    return outWb;
}
