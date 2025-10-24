# WhatsApp Bot AI Agent Expansion Plan

## Business Requirements Coverage

### ✅ Already Implemented
- Faturalar (Invoices)
- Stok (Stock/Inventory)
- Alacaklar (Receivables)
- Borçlar (Debts)
- Giderler (Expenses)
- Aylık raporlar (Monthly reports)
- En çok satan ürünler (Top selling products)
- Müşteri analizi (Customer analysis)

### 🔨 To Be Added

#### 1. Müşteri & Cari Yönetimi
- Müşteri detay bilgileri (address, contact, credit limit)
- Cari hesap hareketleri
- Müşteriye verilen vade süreleri
- Ödeme performans skoru
- Batak müşteri listesi (bad debt customers)

#### 2. Tahsilat Detayları
- Nakit tahsilat
- Çek tahsilatı (check details, vade)
- Kredi kartı tahsilatı
- Senet bilgisi (promissory notes)
- Günlük tahsilat raporu

#### 3. Alış Faturaları & Tedarikçiler
- Alış fatura detayları
- Ürün alış-satış kar marjı
- Tedarikçi borç listesi
- Ödeme vadeleri ve performans

#### 4. Personel & Maaş
- Personel listesi
- Maaş ödemeleri
- Prim ödemeleri
- Avans listesi
- Devamsızlık/izin takibi
- Geç gelme kayıtları

#### 5. Sabit Giderler
- Kira
- Elektrik, su, yakıt
- Bakım giderleri
- SSK, KDV, geçici vergi
- Muhasebe ücretleri

#### 6. Ürün Performans Analizi
- En kötü performans gösteren ürünler
- En çok iade edilen ürünler
- Kampanya ürünleri
- İade ürün listesi

#### 7. Kredi & Ödeme Takibi
- Kredi kartı ödemeleri
- Taksit takibi

## Technical Implementation

### Phase 1: Data Structure Expansion
- Extend `accounting.json` with all new data types
- Add Turkish realistic sample data (3 months)

### Phase 2: Convert to OpenAI Function Calling Agent
- Replace manual FUNCTION_CALL parsing
- Use OpenAI's native tools/function calling
- Enable multi-step reasoning
- Agent can chain multiple function calls

### Phase 3: New Service Methods
- Add ~20-30 new query methods
- Implement complex analytics
- Add reporting functions

### Phase 4: Agent Capabilities
- Handle complex queries ("en kalabalık faturaların detayını ver")
- Multi-step planning
- Aggregate data from multiple sources
- Smart context retention
