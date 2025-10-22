import accountingData from './data/accounting.json';

export class AccountingService {
  private data: typeof accountingData;

  constructor() {
    this.data = accountingData;
  }

  getCompanyInfo(): string {
    const firma = this.data.firma;
    return `
🏢 *${firma.ad}*
Vergi No: ${firma.vergiNo}
Sektör: ${firma.sektor}
Adres: ${firma.adres}
Kuruluş: ${new Date(firma.kurulusTarihi).toLocaleDateString('tr-TR')}
    `.trim();
  }

  getSummary(): string {
    const ozet = this.data.ozet;
    return `
📊 *İşletme Özeti* (Son 3 Ay)

💰 Toplam Ciro: ${this.formatCurrency(ozet.toplamCiro)}
📉 Toplam Gider: ${this.formatCurrency(ozet.toplamGider)}
✅ Net Kar: ${this.formatCurrency(ozet.netKar)}
📈 Kar Marjı: %${ozet.karMarji}

💳 Toplam Alacak: ${this.formatCurrency(ozet.toplamAlacak)}
🔴 Toplam Borç: ${this.formatCurrency(ozet.toplamBorc)}
📦 Stok Değeri: ${this.formatCurrency(ozet.stokDegeri)}

Son Güncelleme: ${new Date(ozet.sonGuncelleme).toLocaleDateString('tr-TR')}
    `.trim();
  }

  getInvoices(filter?: 'tümü' | 'ödendi' | 'beklemede' | 'gecikmiş'): string {
    let faturalar = this.data.faturalar;

    if (filter === 'ödendi') {
      faturalar = faturalar.filter(f => f.durum === 'ödendi');
    } else if (filter === 'beklemede') {
      faturalar = faturalar.filter(f => f.durum === 'beklemede');
    }

    if (faturalar.length === 0) {
      return 'Bu kriterde fatura bulunamadı.';
    }

    const result = faturalar.slice(0, 10).map(f => {
      const durum = f.durum === 'ödendi' ? '✅' : f.durum === 'beklemede' ? '⏳' : '🔄';
      return `${durum} *${f.id}* - ${f.musteri}\n   ${new Date(f.tarih).toLocaleDateString('tr-TR')} | ${this.formatCurrency(f.genelToplam)}`;
    }).join('\n\n');

    return `📄 *Faturalar* ${filter ? `(${filter})` : ''}\n\n${result}`;
  }

  getInvoiceDetail(invoiceId: string): string {
    const fatura = this.data.faturalar.find(f => f.id.toLowerCase() === invoiceId.toLowerCase());

    if (!fatura) {
      return `❌ ${invoiceId} numaralı fatura bulunamadı.`;
    }

    const urunler = fatura.urunler.map(u =>
      `  • ${u.ad}\n    ${u.adet} adet x ${this.formatCurrency(u.birimFiyat)} = ${this.formatCurrency(u.toplam)}`
    ).join('\n');

    const durumEmoji = fatura.durum === 'ödendi' ? '✅' : fatura.durum === 'beklemede' ? '⏳' : '🔄';

    return `
📄 *Fatura Detayı*

Fatura No: ${fatura.id}
Tarih: ${new Date(fatura.tarih).toLocaleDateString('tr-TR')}
Müşteri: ${fatura.musteri}
Vergi No: ${fatura.musteriVergiNo}

*Ürünler:*
${urunler}

Ara Toplam: ${this.formatCurrency(fatura.araToplam)}
KDV: ${this.formatCurrency(fatura.kdvToplam)}
*Genel Toplam: ${this.formatCurrency(fatura.genelToplam)}*

Durum: ${durumEmoji} ${fatura.durum}
${fatura.odemeTarihi ? `Ödeme Tarihi: ${new Date(fatura.odemeTarihi).toLocaleDateString('tr-TR')}` : ''}
${fatura.vadeTarihi ? `Vade Tarihi: ${new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}` : ''}
${fatura.odemeTipi ? `Ödeme Tipi: ${fatura.odemeTipi}` : ''}
    `.trim();
  }

  getExpenses(month?: string): string {
    let giderler = this.data.giderler;

    if (month) {
      const aylar: { [key: string]: string } = {
        'ağustos': '2025-08',
        'eylül': '2025-09',
        'ekim': '2025-10'
      };
      const monthPrefix = aylar[month.toLowerCase()];
      if (monthPrefix) {
        giderler = giderler.filter(g => g.tarih.startsWith(monthPrefix));
      }
    }

    const toplamGider = giderler.reduce((sum, g) => sum + g.tutar, 0);
    const kategoriOzet = this.getExpensesByCategory(giderler);

    const result = giderler.slice(-8).reverse().map(g =>
      `💸 ${new Date(g.tarih).toLocaleDateString('tr-TR')}\n   ${g.aciklama}\n   ${this.formatCurrency(g.tutar)}`
    ).join('\n\n');

    return `
📉 *Giderler* ${month ? `(${month})` : '(Son Kayıtlar)'}

${result}

*Toplam: ${this.formatCurrency(toplamGider)}*

*Kategorilere Göre:*
${kategoriOzet}
    `.trim();
  }

  private getExpensesByCategory(giderler: typeof accountingData.giderler): string {
    const kategoriToplam: { [key: string]: number } = {};

    giderler.forEach(g => {
      if (!kategoriToplam[g.kategori]) {
        kategoriToplam[g.kategori] = 0;
      }
      kategoriToplam[g.kategori] += g.tutar;
    });

    return Object.entries(kategoriToplam)
      .map(([kategori, toplam]) => `  • ${kategori}: ${this.formatCurrency(toplam)}`)
      .join('\n');
  }

  getStock(lowStockOnly: boolean = false): string {
    let stoklar = this.data.stok;

    if (lowStockOnly) {
      stoklar = stoklar.filter(s => s.mevcutMiktar <= s.minimumStok);
    }

    if (stoklar.length === 0) {
      return '✅ Tüm stoklar yeterli seviyede!';
    }

    const toplamDeger = stoklar.reduce((sum, s) => sum + (s.mevcutMiktar * s.birimMaliyet), 0);

    const result = stoklar.slice(0, 15).map(s => {
      const durum = s.mevcutMiktar <= s.minimumStok ? '⚠️' : '✅';
      return `${durum} ${s.urunAdi}\n   Stok: ${s.mevcutMiktar} adet | Değer: ${this.formatCurrency(s.mevcutMiktar * s.birimMaliyet)}`;
    }).join('\n\n');

    return `
📦 *Stok Durumu* ${lowStockOnly ? '(Kritik Stoklar)' : ''}

${result}

${lowStockOnly ? '' : `*Toplam Stok Değeri: ${this.formatCurrency(toplamDeger)}*`}
    `.trim();
  }

  getReceivables(): string {
    const alacaklar = this.data.alacaklar;

    if (alacaklar.length === 0) {
      return '✅ Bekleyen alacak yok!';
    }

    const toplam = alacaklar.reduce((sum, a) => sum + a.tutar, 0);

    const result = alacaklar.map(a => {
      const durum = a.durum === 'gecikmiş' ? '🔴' : a.durum === 'vadesi yaklaşıyor' ? '🟡' : '⏳';
      const gecikme = a.gecikmeGunu > 0 ? ` (${a.gecikmeGunu} gün gecikmiş)` : '';
      return `${durum} ${a.musteri}\n   Fatura: ${a.faturaId}\n   Tutar: ${this.formatCurrency(a.tutar)}${gecikme}\n   Vade: ${new Date(a.vadeTarihi).toLocaleDateString('tr-TR')}`;
    }).join('\n\n');

    return `
💳 *Alacaklar*

${result}

*Toplam Alacak: ${this.formatCurrency(toplam)}*
    `.trim();
  }

  getDebts(): string {
    const borclar = this.data.borclar;

    if (borclar.length === 0) {
      return '✅ Bekleyen borç yok!';
    }

    const toplam = borclar.reduce((sum, b) => sum + b.tutar, 0);

    const result = borclar.map(b => {
      return `🔴 ${b.tedarikci}\n   ${b.aciklama}\n   Tutar: ${this.formatCurrency(b.tutar)}\n   Vade: ${new Date(b.vadeTarihi).toLocaleDateString('tr-TR')}`;
    }).join('\n\n');

    return `
💰 *Borçlar*

${result}

*Toplam Borç: ${this.formatCurrency(toplam)}*
    `.trim();
  }

  getMonthlyReport(month?: string): string {
    let aylar = this.data.aylikOzet;

    if (month) {
      const ayMap: { [key: string]: string } = {
        'ağustos': 'Ağustos 2025',
        'eylül': 'Eylül 2025',
        'ekim': 'Ekim 2025'
      };
      const ayAdi = ayMap[month.toLowerCase()];
      if (ayAdi) {
        aylar = aylar.filter(a => a.ay === ayAdi);
      }
    }

    const result = aylar.map(a =>
      `📅 *${a.ay}*\n   Ciro: ${this.formatCurrency(a.ciro)}\n   Gider: ${this.formatCurrency(a.gider)}\n   Net Kar: ${this.formatCurrency(a.netKar)}\n   Kar Marjı: %${a.karMarji}\n   Fatura: ${a.faturaAdedi} adet | Yeni Müşteri: ${a.yeniMusteri}`
    ).join('\n\n');

    return `📊 *Aylık Performans Raporu*\n\n${result}`;
  }

  getDataContext(): string {
    // Bu method ChatGPT'ye context vermek için kullanılacak
    return JSON.stringify({
      firma: this.data.firma,
      ozet: this.data.ozet,
      faturaAdedi: this.data.faturalar.length,
      bekleyenFatura: this.data.faturalar.filter(f => f.durum === 'beklemede').length,
      kritikStok: this.data.stok.filter(s => s.mevcutMiktar <= s.minimumStok).length,
      gecikmiAlacak: this.data.alacaklar.filter(a => a.durum === 'gecikmiş').length,
      aylikOzet: this.data.aylikOzet
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Serbest sorgu için arama
  searchInData(query: string): any {
    const lowerQuery = query.toLowerCase();
    const results: any = {
      faturalar: [],
      stoklar: [],
      musteriAdlari: new Set<string>()
    };

    // Fatura ara
    this.data.faturalar.forEach(f => {
      if (f.id.toLowerCase().includes(lowerQuery) ||
          f.musteri.toLowerCase().includes(lowerQuery)) {
        results.faturalar.push(f);
        results.musteriAdlari.add(f.musteri);
      }
    });

    // Stok ara
    this.data.stok.forEach(s => {
      if (s.urunAdi.toLowerCase().includes(lowerQuery) ||
          s.urunKodu.toLowerCase().includes(lowerQuery) ||
          s.kategori.toLowerCase().includes(lowerQuery)) {
        results.stoklar.push(s);
      }
    });

    return results;
  }
}
