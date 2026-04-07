import { getNamingValue } from "@/data/naming";

const expeditionNameTr = getNamingValue("expedition_name", "tr");
const artifactMainTr = getNamingValue("artifact_main", "tr");

export const rewardTextsTr = {
  reward_diary_page_01: { title: "İlk Günlük Sayfası", description: "Seferin sesi ilk kez duyuluyor." },
  reward_expedition_stamp_01: { title: "Sefer Mührü", description: `${expeditionNameTr} dosyasının efsane değil gerçek olduğunun kanıtı.` },
  reward_map_piece_01: { title: "İlk Harita Parçası", description: "Rota şekillenmeye başlıyor." },
  reward_camp_marker_01: { title: "Kamp İşareti", description: "Gerçek yolda bir sabit nokta daha." },
  reward_stone_sign_note_01: { title: "Taş İşareti Notu", description: "Yol gösterme sistemine dair sessiz bir ipucu." },
  reward_unknown_item_01: { title: "Kayıtsız Nesne", description: "Resmi envanterde bulunmayan bir buluntu." },
  reward_photo_ridge_01: { title: "Sırt Girişi Fotoğrafı", description: "İleride okunmak üzere saklanmış görsel kanıt." },
  reward_map_variant_01: { title: "Çelişen Rota Şeması", description: "Bölünmüş rotanın ilk belirgin işareti." },
  reward_map_piece_02: { title: "Ek Harita Parçası", description: "Resmi çizgi daha az ikna edici görünüyor." },
  reward_chapter_piece_01: { title: "Bölüm Anahtarı Parçası", description: "İlk bölümün gizli katmanı açılıyor." },
  reward_diary_page_damaged_01: { title: "Hasarlı Günlük Sayfası", description: "Kayıtların tonu değişiyor." },
  reward_map_variant_02: { title: "Çift Çizgili Harita", description: "Aynı anda iki yol görünür hale geliyor." },
  reward_levin_note_01: { title: "Mercer'ın Notu", description: "Buluntunun boyutu daha netleşiyor." },
  reward_hidden_camp_marker_01: { title: "Gizli Kamp İşareti", description: "Rotadaki kasıtlı kayma doğrulanıyor." },
  reward_torn_paper_01: { title: "Yırtılmış Çalışma Kağıdı", description: "Kayıtlar bütün olmaktan çıkıyor." },
  reward_anonymous_note_01: { title: "İmzasız Not", description: "Arşivden içsel bir ses yükseliyor." },
  reward_false_map_piece_01: { title: "Sahte Harita Parçası", description: "Yanıltıcı rota elle tutulur hale geliyor." },
  reward_artifact_case_01: { title: "Eser Kutusu", description: `Ana buluntu ${artifactMainTr} etrafında ağırlık kazanmaya başlıyor.` },
  reward_photo_key_01: { title: "Anahtar Fotoğraf", description: "Gelecekte okunacağı düşünülerek çekilmiş bir kare." },
  reward_chapter_piece_02: { title: "Bölüm Kapanış Parçası", description: "Gizleme artık tartışmasız." },
  reward_map_major_01: { title: "Gizli Haritanın Büyük Parçası", description: "Gerçek rota yeniden birleşmeye başlıyor." },
  reward_diary_page_02: { title: "Son Kısa Kayıt", description: "Günlük saf kesinliğe doğru daralıyor." },
  reward_final_camp_scheme_01: { title: "Son Kamp Şeması", description: "Saklama ve son için hazırlık." },
  reward_personal_item_01: { title: "Kişisel Eşya", description: "Kararın içindeki insanların hatırlatıcısı." },
  reward_artifact_case_major_01: { title: "Disk Kabı", description: `${artifactMainTr} fiziksel bağlamını kazanıyor.` },
  reward_group_photo_final_01: { title: "Son Grup Fotoğrafı", description: "Yalnızca sonucun değil, ekibin de anısı." },
  reward_logistics_note_01: { title: "Lojistik Notu", description: "Seçilen çıkış yolunun mümkün olduğunun kanıtı." },
  reward_archive_note_01: { title: "Arşiv Notu", description: "Kayboluş bir süreç olarak kendini gösteriyor." },
  reward_archive_seal_01: { title: "Arşiv Mührü", description: `${expeditionNameTr} dosyasını kapatmak için son izin.` },
  reward_finale_bundle_01: { title: "Tamamlanmış Arşiv", description: `${artifactMainTr}, eksiksiz harita ve geri kazanılmış hikâye.` },
} as const;
