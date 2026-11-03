## 1. Giriş

Bu rehber, istatistiksel veri ve metaveri değişimi amacıyla sunulan SDMX REST API servisinin genel yapısını ve kullanım esaslarını açıklamak için hazırlanmıştır.

**SDMX (Statistical Data and Metadata eXchange)**, istatistiksel veri ve metaverinin kurumlar arasında ortak standartlarla paylaşılmasını sağlayan uluslararası bir standarttır. Bu standart, farklı sistemler arasında birlikte çalışabilirliği artırmayı ve veri alışverişini modern bilgi teknolojileriyle daha etkin hale getirmeyi amaçlamaktadır. SDMX standardı aynı zamanda ISO 17369 numarasıyla uluslararası standart olarak da yayımlanmıştır.

Bu dokümanda açıklanan işlemler, SDMX 2.1 yapısal nesnelerini desteklemekte olup REST API Specification v1.5 kapsamında tanımlanan SDMX Web Servis kullanım esaslarına dayanmaktadır.

Bu rehberden verimli şekilde yararlanabilmek için XML yapısına ve REST tabanlı web servisler yaklaşımına ilişkin temel bilgiye sahip olunması önerilir.

---

## 2. Temel SDMX Yapıları

SDMX kapsamında kullanılan başlıca bilgi nesneleri SDMX artefact'ları (yapısal bileşenleri) olarak adlandırılır. Bu rehberde geçen temel kavramlar aşağıda özetlenmiştir:

- **Veri Kümesi (Dataset):** Önceden tanımlanmış bir yapıya göre düzenlenmiş, birbiriyle ilişkili gözlemlerden oluşan veri bütünüdür.
- **Veri Yapısı Tanımı (Data Structure Definition - DSD):** Bir veri kümesinin yapısını tanımlayan metaveri bileşenidir. Veri kümesinde kullanılan istatistiksel kavramları, boyutları ve bu kavramlara bağlı kod listelerini içerir.
- **Boyutlar (Dimensions):** Veri kümesinin yapısını belirleyen temel kavramlardır. Örneğin zaman, coğrafi alan veya gösterge gibi alanlar boyut olarak tanımlanabilir.
- **Kod Listesi (Codelist):** Belirli kavramların alabileceği kodlanmış değerlerin tanımlandığı listedir.
- **Öznitelikler (Attributes):** Veri kümesine ek açıklama sağlayan yardımcı bilgi alanlarıdır. Bunlar veri kümesinin temel yapısını değiştirmez.
- **Veri Akışı (Dataflow):** Bir veri kümesini tanımlayan, sınıflandıran ve hangi kapsamda sunulduğunu gösteren yapıdır. Veri kullanıcılarının ilgili veri kümesine erişiminde temel referanslardan biridir.
- **Kavram Şeması (Concept Scheme):** Ortak özelliklere göre gruplanmış kavramların düzenli biçimde tutulduğu yapıdır. Anahtar kavramların ve metaveri tanımlarının yönetilmesini sağlar.

Daha ayrıntılı teknik bilgi için SDMX.org kaynakları ve SDMX bilgi modeli dokümanları da incelenebilir.

---

## 3. Versiyonlu Yapılar Hakkında

SDMX kapsamındaki tüm yapısal bileşenler teorik olarak versiyonlanabilir olsa da, mevcut uygulamada özellikle aşağıdaki yapılar versiyonlu olarak kullanılmaktadır:

- Kod Listeleri (Code Lists - CL)
- Kavram Şemaları (Concept Schemes - CS)
- Veri Yapısı Tanımları (DSD)
- Veri Akışları (Dataflows - DF)

Bu yapılar belirli bir sürüm numarası ile tanımlanır ve son hali ifade edecek şekilde yayımlanır. Bu nedenle, ilgili sürümler güvenle kopyalanabilir veya önbelleğe alınabilir.

Bunun dışında kalan bazı yapılar ise varsayılan olarak **"1.0"** sürümü ile kullanılabilir. Güncel bilgiye ihtiyaç duyulduğunda bu yapıların servisten yeniden sorgulanması önerilir.

---

## 4. Kimlik Doğrulama ve Yetkilendirme

SDMX servislerine erişim, TÜİK giriş sistemi üzerinden alınan erişim belirteci (access token) ile sağlanmaktadır. Bu nedenle, yapılacak tüm isteklerde geçerli bir token bilgisinin kullanılması gerekmektedir.

Bu kapsamda, servislere erişecek her kurum veya kullanıcı için sistem tarafında yetkili bir istemci hesabı tanımlanmalıdır. Tanımlanan istemciye ait bilgiler kullanılarak önce token alınır, ardından bu token ilgili servis çağrısında Authorization başlığı içerisinde gönderilir.

### 4.1 Veri Portalı Kullanıcıları için SMS Doğrulamalı API Anahtarı Üretimi

[Veri Portalı](https://veriportali.tuik.gov.tr/tr) uygulamasında kullanıcılar sisteme kullanıcı adı ve şifre ile giriş yapabilmektedir.

![Veri Portalı'nda Telefon Doğrulama İşlemi](/assets/images/phone_verification_tr.png)

SDMX servislerine erişim kapsamında, portal üzerinden kimliği doğrulanmış kullanıcılar, “Kullanıcı Bilgileri” ekranında SMS ile telefon numarası doğrulama işlemini tamamladıktan sonra üretilen API Anahtarı kullanılarak servislere erişim sağlayabilmektedir.

![Veri Portalı API Anahtarı](/assets/images/api_key_tr.png)

### 4.2 Türkiye’de Geçerli Telefon Hattına Sahip Olmayan Kullanıcılar İçin API Anahtarı Oluşturulması

Türkiye’de faaliyet gösteren operatörlere ait bir telefon numarası bulunmayan kullanıcılar, API Anahtarı (API Key) talepleri için info@tuik.gov.tr adresinden iletişime geçebilirler.

### 4.3 Token Alma İşlemi

Token almak için TÜİK giriş sistemindekitoken servis uç noktasına istek gönderilmelidir. Token alma işlemi sonucunda dönen access token değeri, daha sonraki servis çağrılarında kullanılacaktır.

> Token servisi adresi: <https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token>

Türkiye telefon numarasına sahip kullanıcılar, Veri Portalı üzerinden SMS doğrulaması yaparak kendi API Key'lerini oluşturur ve bu API Key ile token alırlar.

Türkiye telefon numarasına sahip olmayan kullanıcılar için gerekli erişim bilgileri, 4.2 bölümünde belirtildiği şekilde talep edildikten sonra TÜİK tarafından tanımlanır ve paylaşılır. Bu kullanıcılar kendilerine iletilen erişim bilgileri ile token alarak servisleri kullanabilirler.

#### 4.3.1 API Key Kullanan Kullanıcılar İçin Token Alma

API key oluşturan kullanıcının token almak için yapacağı işlemler aşağıdaki gibidir.

```bash
curl -X POST "https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=password" \
  --data "client_id=nsi-ws-consumer" \
  --data "api_key={API KEY}"
```

#### 4.3.2 TÜİK Tarafından Erişim Bilgileri Tanımlanan Kullanıcılar İçin Token Alma

Türkiye telefon numarasına sahip olmayan kullanıcıların token alma işlemi aşağıdaki örnek yapıya göre gerçekleştirilebilir:

```bash
curl -X POST "https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials" \
  --data "client_id={client_id}" \
  --data "client_secret={client_secret}"
```

Her iki yöntemde de çağrı sonucunda dönen yanıtta yer alan access_token değeri alınarak sonraki servis çağrılarında kullanılmalıdır.

### 4.4 Token ile Servis Çağrısı Yapılması

Token alındıktan sonra, SDMX servislerine yapılacak isteklerde bu değer HTTP başlığında Bearer Token olarak gönderilmelidir.

Örnek servis çağrısı aşağıda verilmiştir:

```bash
curl -X GET "https://nsiws.tuik.gov.tr/rest/dataflow/TR/all/latest?detail=full" \
  --header "Authorization: Bearer {access_token}" \
  --verbose
```

Burada `{access_token}` ifadesi, bir önceki adımda token servisinden alınan erişim belirtecini ifade etmektedir.

---

## 5. Yapısal Metaveri Bileşenlerinin Getirilmesi

Bir veri kümesine ait çevrim içi veri kodundan hareketle, API üzerinden o veri kümesine bağlı ayrıntılı metaveri bileşenlerine erişilebilir.

### 5.1. SDMX Dataflow Üzerinden Veri Kümesi Metaverisinin Sorgulanması

Örnek olarak `DF_EMISYON_DEGISIM_ORAN` veri akışı ele alındığında, veri kümesine ilişkin temel metaveri bilgilerine ilgili Dataflow nesnesi üzerinden erişilebilir.

> <https://nsiws.tuik.gov.tr/rest/dataflow/TR/DF_EMISYON_DEGISIM_ORAN/1.1/>

Bu sorgunun döndürdüğü asgari yanıtta, veri kümesinin adı ile bu veri kümesinde kullanılan versiyonlu DSD referansı yer alır.

Buradaki yapıdan aşağıdaki bilgiler elde edilir:

- dataflowun kimliği (dataflow_ID)
- Kurum kodu
- Sürüm bilgisi
- Türkçe ve İngilizce ad bilgileri
- Türkçe ve İngilizce açıklama bilgileri
- Veri kümesinin bağlı olduğu DSD referansı

Başka bir ifadeyle, bir veri kümesinin hangi yapısal tanıma göre yayımlandığını anlamak için ilk bakılması gereken artefact Dataflow'dur.

```xml
<structure:Dataflows>
  <structure:Dataflow id="DF_EMISYON_DEGISIM_ORAN" agencyID="TR" version="1.1" isFinal="true">
    <common:Name xml:lang="tr">Emisyon Değişim Oranı</common:Name>
    <common:Name xml:lang="en">Emissions Rate of Change</common:Name>
    <common:Description xml:lang="en">It includes data about emissions rate of change.</common:Description>
    <common:Description xml:lang="tr">Emisyon değişim oranı ile ilgili verileri içerir.</common:Description>
    <structure:Structure>
      <Ref id="DSD_SERA_GAZ_EMISYON_IST" version="1.5" agencyID="TR" package="datastructure" class="DataStructure" />
    </structure:Structure>
  </structure:Dataflow>
</structure:Dataflows>
```

XML örneğinde görüldüğü üzere, `DF_EMISYON_DEGISIM_ORAN` veri akışı `DSD_SERA_GAZ_EMISYON_IST` adlı ve 1.5 sürüm numarasına sahip veri yapısı tanımına bağlıdır. Bu ilişki sayesinde kullanıcı, yalnızca veri kümesini değil, veri kümesinin hangi yapısal kurallara göre oluşturulduğunu da görebilir.

**DF_EMISYON_DEGISIM_ORAN Dataflow XML:**

```xml
<message:Structure
  xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"
  xmlns:structure="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure"
  xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common">
  <message:Header>
    <message:ID>IDREF97</message:ID>
    <message:Test>false</message:Test>
    <message:Prepared>2026-03-27T14:37:24.261744+03:00</message:Prepared>
    <message:Sender id="Unknown"/>
    <message:Receiver id="Unknown"/>
  </message:Header>
  <message:Structures>
    <structure:Dataflows>
      <structure:Dataflow id="DF_EMISYON_DEGISIM_ORAN" agencyID="TR" version="1.1" isFinal="true">
        <common:Name xml:lang="tr">Emisyon Değişim Oranı</common:Name>
        <common:Name xml:lang="en">Emissions Rate of Change</common:Name>
        <common:Description xml:lang="en">It includes data about emissions rate of change.</common:Description>
        <common:Description xml:lang="tr">Emisyon değişim oranı ile ilgili verileri içerir.</common:Description>
        <structure:Structure>
          <Ref id="DSD_SERA_GAZ_EMISYON_IST" version="1.5" agencyID="TR" package="datastructure" class="DataStructure"/>
        </structure:Structure>
      </structure:Dataflow>
    </structure:Dataflows>
  </message:Structures>
</message:Structure>
```

_`DF_EMISYON_DEGISIM_ORAN` veri akışına ait örnek dataflow XML çıktısı_

### 5.2 Referans Verilen Veri Yapısı Tanımının (DSD) Sorgulanması

Dataflow içerisinde yer alan referans kullanılarak ilgili Veri Yapısı Tanımı (Data Structure Definition - DSD) doğrudan sorgulanabilir.

> DSD linki: <https://nsiws.tuik.gov.tr/rest/datastructure/TR/DSD_SERA_GAZ_EMISYON_IST/1.5>

Bu yapılar versiyonlu olduğu için, sorgulama yapılırken referansta belirtilen sürüm bilgisinin kullanılması önemlidir. Böylece veri akışı ile veri yapısı tanımı arasında tutarlılık sağlanmış olur.

DSD, veri kümesini tanımlayan boyutları içermektedir. Bu boyutların sıralaması önemlidir; çünkü veri sorgularında kullanılacak anahtar filtre yapısı bu sıraya göre oluşturulmaktadır.

Her bir boyut için aşağıdaki referanslar sağlanır:

**1. Boyut etiketini içeren kavram (concept) referansı:** Kavram, bir kavram şeması içinde yer alan tanımlı bir öğedir. Mevcut TÜİK yayım zincirinde bir DSD, birden fazla Concept Scheme referansı içerebilir. Bu kavram şemalarının kimlik ve sürüm bilgileri birbirinden farklı olabilir.

> Concept Scheme linkleri (yukarıdaki DSD örneği için):
>
> - <https://nsiws.tuik.gov.tr/rest/conceptscheme/TR/CROSS_DOMAIN_CONCEPTS_TUIK/1.0>
> - <https://nsiws.tuik.gov.tr/rest/conceptscheme/TR/CS_CEVRE/1.0>

Bu örnekte ilgili kod listeleri aşağıdaki gibidir:

**2. Boyutlara ait kod ve etiketleri içeren kod listesi (codelist) referansı:** Her boyut için ilgili kod listesi bağlantısı da DSD içerisinde tanımlanmaktadır. Bu kod listeleri, boyutların alabileceği değerleri ve bu değerlere karşılık gelen açıklamaları içerir.

| Boyut       | Sürüm | Kod listesi bağlantısı                                       |
| ----------- | ----- | ------------------------------------------------------------ |
| CL_SIKLIK   | 1.0   | <https://nsiws.tuik.gov.tr/rest/codelist/TR/CL_SIKLIK/1.0>   |
| CL_IBBS     | 1.1   | <https://nsiws.tuik.gov.tr/rest/codelist/TR/CL_IBBS/1.1>     |
| CL_DEGISIM  | 3.0   | <https://nsiws.tuik.gov.tr/rest/codelist/TR/CL_DEGISIM/3.0>  |
| CL_GOSTERGE | 7.2   | <https://nsiws.tuik.gov.tr/rest/codelist/TR/CL_GOSTERGE/7.2> |
| CL_GIZLILIK | 1.0   | <https://nsiws.tuik.gov.tr/rest/codelist/TR/CL_GIZLILIK/1.0> |

_Tablo 1. DSD'de referans verilen kod listeleri_

Bu kod listeleri referans metaveri niteliğindedir. Bu nedenle, bir kod listesi ilgili veri kümesinde kullanılmayan ek kod ve etiketler de içerebilir. Veri kümesinde fiilen kullanılan boyut değerlerinin belirlenebilmesi için **Content Constraints** artefact'ının incelenmesi gerekir.

Ayrıca DSD içerisinde aşağıdaki temel bileşenler de tanımlanmaktadır:

- **TIME_PERIOD:** Zaman boyutunu ifade eder ve değerleri ISO 8601 standardına göre gösterilir.
- **OBS_VALUE:** İstatistiksel gözlem değerini içerir.
- **OBS_FLAG:** Gözleme ilişkin durum veya bayrak bilgisini içerir ve isteğe bağlıdır.

Bu nedenle DSD, bir veri kümesinin hangi boyutlardan oluştuğunu, bu boyutların hangi kavramlara dayandığını ve hangi kod listeleri ile tanımlandığını gösteren temel yapısal bileşendir.

### 5.3 Birden Fazla Artefact Yapısının Tek bir Yanıtta Getirilmesi

Yukarıda açıklanan artefact'ların her birinin tek tek sorgulanması zorunlu değildir. Dataflow sorgusundan başlanarak, ilişkili yapısal bileşenler farklı kapsam seviyelerinde aynı yanıt içerisinde birlikte getirilebilir. Bu yaklaşım, kullanıcıların tek tek ayrı servis çağrıları yapmak yerine ihtiyaç duydukları ilişkili metaveri bileşenlerine daha hızlı erişmesini sağlar.

Örneğin, bir Dataflow sorgusu yapılırken referans verilen artefact'lar aşağıdaki kapsam seçenekleriyle birlikte alınabilir:

| Kapsam                                      | Bağlantı                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Dataflow + DSD                              | <https://nsiws.tuik.gov.tr/rest/dataflow/TR/DF_EMISYON_DEGISIM_ORAN/1.1?references=children>    |
| Dataflow + DSD + Concept Scheme ve Codelist | <https://nsiws.tuik.gov.tr/rest/dataflow/TR/DF_EMISYON_DEGISIM_ORAN/1.1?references=descendants> |

_Tablo 2. Tek bir yanıtta birlikte getirilebilecek artefact kapsamları_

Bu kapsam seçenekleri sayesinde kullanıcı, yalnızca veri akışını değil, ona bağlı veri yapısı tanımını, kavram şemalarını ve kod listelerini de tek bir yanıt içerisinde elde edebilir. Böylece servis kullanımında hem işlem sayısı azalır hem de ilişkili yapılar arasındaki bütünlük daha kolay izlenebilir.

Benzer şekilde, ilgili referanslar DSD doğrudan sorgulanırken de yanıta dahil edilebilir:

> <https://nsiws.tuik.gov.tr/rest/datastructure/TR/DSD_SERA_GAZ_EMISYON_IST/1.5?references=children>

Bu yöntem özellikle yapısal metaverinin toplu şekilde incelenmek istendiği durumlarda kullanışlıdır. Kullanıcı, sorgu parametreleri aracılığıyla ihtiyaç duyduğu ayrıntı seviyesini belirleyebilir ve buna göre daha kapsamlı ya da daha sınırlı yanıtlar alabilir.

### 5.4 Özel Durum: Veri Kümelerinin Toplu Olarak Listelenmesi

Dataflow sorgusunda tek bir veri kümesi kodu belirtmek yerine, ALL anahtar sözcüğü kullanılarak tüm veri kümeleri tek bir çağrı ile listelenebilir. Bu yöntem, serviste yer alan tüm veri akışlarının topluca görüntülenmek istenmesi durumunda kullanılabilir.

> Tüm dataflowları listelemek için: <https://nsiws.tuik.gov.tr/rest/dataflow/TR/latest>

Bu sorgu sonucunda, ilgili kuruma ait tüm veri akışları tek bir yanıt içerisinde döndürülür. Özellikle veri kümesi envanterinin çıkarılması, mevcut veri akışlarının toplu olarak görülmesi veya istemci tarafında başlangıç listesi oluşturulması gibi amaçlarla kullanılabilir. Kaynak dokümanda bu sorgu için sıkıştırılmış yanıt kullanımının tercih edilmesi önerilmektedir.

### 5.5 Özel Durum: Metaverinin Toplu Olarak Alınması

Benzer şekilde, belirli bir artefact türüne ait en güncel sürümler toplu olarak da sorgulanabilir. Bu yöntem, tek tek nesne bazında çağrı yapmak yerine belirli bir yapısal bileşen türünün tamamını bir arada almak için kullanılmaktadır. Özellikle kod listeleri, kavram şemaları ve veri yapısı tanımları gibi yapısal metaveri bileşenlerinin toplu olarak elde edilmesi gereken durumlarda fayda sağlar.

Aşağıdaki örnek linkler ile farklı artefact türleri toplu şekilde sorgulanabilir:

| Kapsam                    | Bağlantı                                              |
| ------------------------- | ----------------------------------------------------- |
| Tüm kod listeleri         | <https://nsiws.tuik.gov.tr/rest/codelist/TR/all>      |
| Tüm kavram şemaları       | <https://nsiws.tuik.gov.tr/rest/conceptscheme/TR/all> |
| Tüm veri yapısı tanımları | <https://nsiws.tuik.gov.tr/rest/datastructure/TR/all> |

_Tablo 3. Toplu metaveri sorgulama bağlantıları_

Bu sorgular sayesinde istemci uygulamalar, ihtiyaç duydukları yapısal metaveriyi toplu biçimde alarak kendi taraflarında işleyebilir, saklayabilir veya senkronizasyon amacıyla kullanabilir. Bu yaklaşım, özellikle metadata harvesting senaryolarında kullanım kolaylığı sağlamaktadır.

Dokümanda ayrıca codelist/TR/all çağrısı için hata alındığı not edilmiştir. Bu nedenle, bu uç noktanın mevcut servis yapısında düzgün çalışıp çalışmadığının ayrıca teknik olarak doğrulanması gerekmektedir. Gerekirse bu bölümde yer alan toplu metaveri alma servislerinin destek durumu ve hata davranışları netleştirilmelidir.

---

## 6. Veri Sorgulama

SDMX 2.1 yapısında veri sorguları, doğrudan Dataflow tanımı kullanılarak gerçekleştirilmektedir. Bu nedenle veri talep edilirken istek adresinde ilgili veri akışının tanımlayıcısı yer alır.

> Veri sorgusu linki: <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1>

Yukarıdaki bağlantı, ilgili veri kümesinin tamamını varsayılan çıktı formatında döndürmektedir. Varsayılan format **SDMX-ML 2.1 Generic Data** biçimidir. Bu formatta dönen veri dosyası, zaman serileri halinde düzenlenmiş gözlemlerden oluşur. Her bir zaman serisi, ilgili boyut değerlerini içeren bir series key ile tanımlanır ve bu anahtara bağlı gözlem değerleri listelenir.

```xml
<generic:Series>
  <generic:SeriesKey>
    <generic:Value id="FREQ" value="A"/>
    <generic:Value id="REF_AREA" value="TR"/>
    <generic:Value id="DEGISIM" value="13"/>
    <generic:Value id="SERAGAZ_KAYNAK_SEKTOR" value="_T"/>
    <generic:Value id="INDICATOR" value="C_ROCGHG"/>
    <generic:Value id="SERAGAZ_TUR" value="_T"/>
  </generic:SeriesKey>
  <generic:Obs>
    <generic:ObsDimension id="TIME_PERIOD" value="1991"/>
    <generic:ObsValue value="3.274369398"/>
  </generic:Obs>
  <generic:Obs>
    <generic:ObsDimension id="TIME_PERIOD" value="1992"/>
    <generic:ObsValue value="6.020485616"/>
  </generic:Obs>
  <generic:Obs>
    <generic:ObsDimension id="TIME_PERIOD" value="1993"/>
    <generic:ObsValue value="9.211511938"/>
  </generic:Obs>
  ...
  <generic:Obs>
    <generic:ObsDimension id="TIME_PERIOD" value="2024"/>
    <generic:ObsValue value="155.3345774"/>
  </generic:Obs>
</generic:Series>
```

_Örnek SDMX-ML 2.1 Generic Data seri yapısı_

Başka bir ifadeyle, veri sorgusu sonucunda dönen yapı içerisinde önce seriyi tanımlayan boyut kombinasyonu, ardından bu kombinasyona ait zaman ve gözlem değerleri yer almaktadır. Bu yaklaşım, özellikle çok boyutlu istatistiksel verilerin standart bir yapıda sunulmasını sağlar. Ayrıca veri sorguları yalnızca veri kümesinin tamamını almak için değil, belirli boyutlara, zaman aralıklarına veya farklı çıktı formatlarına göre özelleştirilmiş sonuçlar elde etmek amacıyla da kullanılabilir. Bu nedenle veri sorgulama bölümü, API kullanımının en temel ve en işlevsel kısmını oluşturmaktadır.

### 6.1 Seri Anahtarlarına Göre Filtreleme

SDMX REST web servisinde filtreleme işlemi, veri yapısı tanımında (DSD) belirtilen boyut sırasına göre oluşturulan seri anahtarı (series key) üzerinden yapılmaktadır. Bu nedenle veri sorgusu oluşturulurken, anahtar yapısında yer alan boyutların sırası dikkate alınmalıdır.

`DF_EMISYON_DEGISIM_ORAN` veri akışı için seri anahtarı şablonu:

```
FREQ.REF_AREA.DEGISIM.SERAGAZ_KAYNAK_SEKTOR.INDICATOR.SERAGAZ_TUR
```

Bu yapı içerisinde her bir bölüm ilgili bir boyutu temsil etmektedir. Sorgu yapılırken, istenen boyut değerleri bu sıraya uygun şekilde yazılmalıdır.

Seri anahtarına göre filtreleme yapılırken aşağıdaki kurallar uygulanır:

- Bir boyut için filtre uygulanmayacaksa ilgili alan boş bırakılır.
- Aynı boyut için birden fazla değer kullanılacaksa değerler + işareti ile ayrılır.

Bu yöntem sayesinde kullanıcı, veri kümesinin tamamını almak yerine yalnızca belirli boyut kombinasyonlarına karşılık gelen serileri sorgulayabilir. Böylece daha daraltılmış ve ihtiyaca uygun veri elde edilebilir.

Örneğin, tek bir zaman serisini tam olarak tanımlamak için tüm boyutlara ait değerler belirtilerek aşağıdaki gibi bir sorgu yapılabilir:

- FREQ = A
- REF_AREA = TR
- DEGISIM = 13
- SERAGAZ_KAYNAK_SEKTOR = 1_A_1
- INDICATOR = C_ROCGHG
- SERAGAZ_TUR = 3

Bu durumda kullanılacak sorgu adresi şu şekildedir:

> Veri sorgusu linki: <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1/A.TR.13.1_A_1.C_ROCGHG.3>

Bu sorgu, yalnızca belirtilen boyut kombinasyonuna karşılık gelen tek bir zaman serisini döndürür.

Buna karşılık, yalnızca son boyutta yer alan bir değere göre filtreleme yapılmak istenirse, önceki boyutlar boş bırakılarak sorgu oluşturulabilir. Örneğin yalnızca **SERAGAZ_TUR = 3** değerine göre filtreleme yapılacaksa aşağıdaki yapı kullanılır:

> Veri sorgusu linki: <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1/.....3>

### 6.2 Zaman Dönemine Göre Filtreleme

Gözlem değerlerinin `TIME_PERIOD` alanına göre filtrelenmesi, `startPeriod` ve `endPeriod` sorgu parametreleri kullanılarak yapılmaktadır. Bu parametreler büyük-küçük harfe duyarlıdır ve doğru şekilde yazılmalıdır. Böylece veri sorguları belirli bir zaman aralığı ile sınırlandırılabilir.

Daha önce verilen tek zaman serisi örneği yeniden kullanıldığında, sonuçların yalnızca 2008–2010 dönemi ile sınırlandırılması için aşağıdaki sorgu yapılabilir:

> Veri sorgusu linki: <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1/A.TR.13.1_A_1.C_ROCGHG.3?startPeriod=2008&endPeriod=2010>

Bu sorgu sonucunda yalnızca belirtilen seri anahtarına ait ve verilen zaman aralığında bulunan gözlemler döndürülür. Bu yaklaşım, veri kümesinin tamamını almak yerine yalnızca ihtiyaç duyulan dönemlerin çekilmesini sağlayarak daha hedefli veri erişimi sunar. Özellikle uzun dönemli zaman serilerinde veri hacmini azaltmak ve sorgu sonuçlarını daraltmak açısından faydalıdır.

### 6.3 Desteklenen Çıktı Formatları

Veri sorgularında, yanıtın farklı bir anlamsal formatta alınabilmesi için ek bir format parametresi kullanılabilir. Bu sayede aynı veri kümesi, kullanım amacına göre farklı çıktı biçimlerinde talep edilebilir. Örneğin XML tabanlı daha kompakt bir yapı, standartlaştırılmış CSV çıktısı veya JSON tabanlı kullanım seçenekleri tercih edilebilir.

| Format                      | Açıklama                                           | Örnek Bağlantı                                                                                  |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SDMX-ML 2.1 Structured Data | Daha kompakt XML formatı                           | <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1?format=SDMX_2.1_STRUCTURED> |
| SDMX-CSV 1.0                | SDMX standardına uygun CSV formatı                 | <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1?format=SDMX-CSV>            |
| JSONstat                    | JSON-stat araçları ile kullanılabilen JSON formatı | <https://nsiws.tuik.gov.tr/rest/data/TR,DF_EMISYON_DEGISIM_ORAN,1.1?format=JSON>                |

_Tablo 4. Desteklenen çıktı formatları_

Bu yapı sayesinde kullanıcılar, veriyi kendi uygulama ihtiyaçlarına uygun formatta alabilir. Örneğin XML tabanlı entegrasyonlar için SDMX-ML biçimi, tablo tabanlı işleme ihtiyaçları için CSV biçimi ve web uygulamaları ya da JSON tabanlı istemciler için JSON formatı tercih edilebilir.

---

## 7. Gezinme Amaçlı Artefactların Getirilmesi

Ana veri ve yapı artefact'larına ek olarak, SDMX kapsamında veri kümelerinin sınıflandırılmasına yönelik ikincil artefact'lar da bulunmaktadır. Bu yapılar, veri kümelerinin konu başlıkları altında düzenli biçimde sunulmasına yardımcı olur ve zaman zaman bir navigasyon ağacı olarak da değerlendirilebilir.

Bu kapsamda öne çıkan iki temel yapı şunlardır:

- **Category Scheme:** Kategorilerin hiyerarşik yapıda tanımlandığı yapıdır.
- **Categorisation:** Bir veri kümesinin, ilgili Category Scheme içinde hangi kategori altında yer aldığını gösteren yapıdır.

Bu artefact'lar sayesinde veri kümeleri yalnızca teknik yapılarıyla değil, aynı zamanda konu bazlı sınıflandırmalarıyla da düzenli şekilde sunulabilir. Özellikle kullanıcıların veri kümeleri arasında gezinmesini kolaylaştıran menü, ağaç yapı veya kategori bazlı listeleme senaryolarında bu yapılar önem taşımaktadır.

Aşağıdaki örnek bağlantılar ile bu yapılar toplu olarak sorgulanabilir:

| Kapsam                | Bağlantı                                               |
| --------------------- | ------------------------------------------------------ |
| Tüm kategori şemaları | <https://nsiws.tuik.gov.tr/rest/categoryscheme/TR/all> |
| Tüm kategorizasyonlar | <https://nsiws.tuik.gov.tr/rest/categorisation/TR/all> |

_Tablo 5. Gezinme amaçlı artefact sorgulama bağlantıları_

Bu servisler kullanılarak, veri kümelerinin hangi kategori yapıları altında tanımlandığı ve ilgili sınıflandırma ilişkilerinin nasıl kurulduğu görülebilir. Böylece istemci uygulamalar, veri kümelerini yalnızca kod veya veri akışı bazında değil, konu bazlı bir gezinme yapısı içinde de sunabilir.
