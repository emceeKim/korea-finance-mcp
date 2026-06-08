/**
 * 한국 부동산 API 클라이언트 (RTMS + R-ONE 통합 베이스)
 *
 * @see wiki/korea-finance-mcp/realestate-api-research.md
 * @see wiki/decisions/korea-finance-mcp-realestate-data-policy-2026-W22.md
 * @see wiki/korea-finance-mcp/code-signature-patterns.md (6 패턴 적용)
 */

import { z } from "zod";

// KNOWN_REGIONS — 정적 사전 (법정동코드 5자리, 행정안전부 공식 표준)
// v1.2 (WO-118): 전국 17개 광역 + 226개 시군구 등록. 정부 RTMS 공개 수준과 동일.
//                미등록 코드는 형식 검증만 통과 → RTMS API 자체 검증에 위임 (안전망).
export const KNOWN_REGIONS: Record<string, {
  code: string;
  name_ko: string;
  name_short: string;
}> = {
  // ===== 서울특별시 (11) — 25개 자치구 =====
  "11110": { code: "11110", name_ko: "서울특별시 종로구", name_short: "종로구" },
  "11140": { code: "11140", name_ko: "서울특별시 중구", name_short: "서울중구" },
  "11170": { code: "11170", name_ko: "서울특별시 용산구", name_short: "용산구" },
  "11200": { code: "11200", name_ko: "서울특별시 성동구", name_short: "성동구" },
  "11215": { code: "11215", name_ko: "서울특별시 광진구", name_short: "광진구" },
  "11230": { code: "11230", name_ko: "서울특별시 동대문구", name_short: "동대문구" },
  "11260": { code: "11260", name_ko: "서울특별시 중랑구", name_short: "중랑구" },
  "11290": { code: "11290", name_ko: "서울특별시 성북구", name_short: "성북구" },
  "11305": { code: "11305", name_ko: "서울특별시 강북구", name_short: "강북구" },
  "11320": { code: "11320", name_ko: "서울특별시 도봉구", name_short: "도봉구" },
  "11350": { code: "11350", name_ko: "서울특별시 노원구", name_short: "노원구" },
  "11380": { code: "11380", name_ko: "서울특별시 은평구", name_short: "은평구" },
  "11410": { code: "11410", name_ko: "서울특별시 서대문구", name_short: "서대문구" },
  "11440": { code: "11440", name_ko: "서울특별시 마포구", name_short: "마포구" },
  "11470": { code: "11470", name_ko: "서울특별시 양천구", name_short: "양천구" },
  "11500": { code: "11500", name_ko: "서울특별시 강서구", name_short: "강서구" },
  "11530": { code: "11530", name_ko: "서울특별시 구로구", name_short: "구로구" },
  "11545": { code: "11545", name_ko: "서울특별시 금천구", name_short: "금천구" },
  "11560": { code: "11560", name_ko: "서울특별시 영등포구", name_short: "영등포구" },
  "11590": { code: "11590", name_ko: "서울특별시 동작구", name_short: "동작구" },
  "11620": { code: "11620", name_ko: "서울특별시 관악구", name_short: "관악구" },
  "11650": { code: "11650", name_ko: "서울특별시 서초구", name_short: "서초구" },
  "11680": { code: "11680", name_ko: "서울특별시 강남구", name_short: "강남구" },
  "11710": { code: "11710", name_ko: "서울특별시 송파구", name_short: "송파구" },
  "11740": { code: "11740", name_ko: "서울특별시 강동구", name_short: "강동구" },

  // ===== 부산광역시 (26) — 15구 + 1군 =====
  "26110": { code: "26110", name_ko: "부산광역시 중구", name_short: "부산중구" },
  "26140": { code: "26140", name_ko: "부산광역시 서구", name_short: "부산서구" },
  "26170": { code: "26170", name_ko: "부산광역시 동구", name_short: "부산동구" },
  "26200": { code: "26200", name_ko: "부산광역시 영도구", name_short: "영도구" },
  "26230": { code: "26230", name_ko: "부산광역시 부산진구", name_short: "부산진구" },
  "26260": { code: "26260", name_ko: "부산광역시 동래구", name_short: "동래구" },
  "26290": { code: "26290", name_ko: "부산광역시 남구", name_short: "부산남구" },
  "26320": { code: "26320", name_ko: "부산광역시 북구", name_short: "부산북구" },
  "26350": { code: "26350", name_ko: "부산광역시 해운대구", name_short: "해운대구" },
  "26380": { code: "26380", name_ko: "부산광역시 사하구", name_short: "사하구" },
  "26410": { code: "26410", name_ko: "부산광역시 금정구", name_short: "금정구" },
  "26440": { code: "26440", name_ko: "부산광역시 강서구", name_short: "부산강서구" },
  "26470": { code: "26470", name_ko: "부산광역시 연제구", name_short: "연제구" },
  "26500": { code: "26500", name_ko: "부산광역시 수영구", name_short: "수영구" },
  "26530": { code: "26530", name_ko: "부산광역시 사상구", name_short: "사상구" },
  "26710": { code: "26710", name_ko: "부산광역시 기장군", name_short: "기장군" },

  // ===== 대구광역시 (27) — 7구 + 2군 (군위군 2023 편입) =====
  "27110": { code: "27110", name_ko: "대구광역시 중구", name_short: "대구중구" },
  "27140": { code: "27140", name_ko: "대구광역시 동구", name_short: "대구동구" },
  "27170": { code: "27170", name_ko: "대구광역시 서구", name_short: "대구서구" },
  "27200": { code: "27200", name_ko: "대구광역시 남구", name_short: "대구남구" },
  "27230": { code: "27230", name_ko: "대구광역시 북구", name_short: "대구북구" },
  "27260": { code: "27260", name_ko: "대구광역시 수성구", name_short: "수성구" },
  "27290": { code: "27290", name_ko: "대구광역시 달서구", name_short: "달서구" },
  "27710": { code: "27710", name_ko: "대구광역시 달성군", name_short: "달성군" },
  "27720": { code: "27720", name_ko: "대구광역시 군위군", name_short: "군위군" },

  // ===== 인천광역시 (28) — 8구 + 2군 =====
  "28110": { code: "28110", name_ko: "인천광역시 중구", name_short: "인천중구" },
  "28140": { code: "28140", name_ko: "인천광역시 동구", name_short: "인천동구" },
  "28177": { code: "28177", name_ko: "인천광역시 미추홀구", name_short: "미추홀구" },
  "28185": { code: "28185", name_ko: "인천광역시 연수구", name_short: "연수구" },
  "28200": { code: "28200", name_ko: "인천광역시 남동구", name_short: "남동구" },
  "28237": { code: "28237", name_ko: "인천광역시 부평구", name_short: "부평구" },
  "28245": { code: "28245", name_ko: "인천광역시 계양구", name_short: "계양구" },
  "28260": { code: "28260", name_ko: "인천광역시 서구", name_short: "인천서구" },
  "28710": { code: "28710", name_ko: "인천광역시 강화군", name_short: "강화군" },
  "28720": { code: "28720", name_ko: "인천광역시 옹진군", name_short: "옹진군" },

  // ===== 광주광역시 (29) — 5구 =====
  "29110": { code: "29110", name_ko: "광주광역시 동구", name_short: "광주동구" },
  "29140": { code: "29140", name_ko: "광주광역시 서구", name_short: "광주서구" },
  "29155": { code: "29155", name_ko: "광주광역시 남구", name_short: "광주남구" },
  "29170": { code: "29170", name_ko: "광주광역시 북구", name_short: "광주북구" },
  "29200": { code: "29200", name_ko: "광주광역시 광산구", name_short: "광산구" },

  // ===== 대전광역시 (30) — 5구 =====
  "30110": { code: "30110", name_ko: "대전광역시 동구", name_short: "대전동구" },
  "30140": { code: "30140", name_ko: "대전광역시 중구", name_short: "대전중구" },
  "30170": { code: "30170", name_ko: "대전광역시 서구", name_short: "대전서구" },
  "30200": { code: "30200", name_ko: "대전광역시 유성구", name_short: "유성구" },
  "30230": { code: "30230", name_ko: "대전광역시 대덕구", name_short: "대덕구" },

  // ===== 울산광역시 (31) — 4구 + 1군 =====
  "31110": { code: "31110", name_ko: "울산광역시 중구", name_short: "울산중구" },
  "31140": { code: "31140", name_ko: "울산광역시 남구", name_short: "울산남구" },
  "31170": { code: "31170", name_ko: "울산광역시 동구", name_short: "울산동구" },
  "31200": { code: "31200", name_ko: "울산광역시 북구", name_short: "울산북구" },
  "31710": { code: "31710", name_ko: "울산광역시 울주군", name_short: "울주군" },

  // ===== 세종특별자치시 (36) =====
  "36110": { code: "36110", name_ko: "세종특별자치시", name_short: "세종시" },

  // ===== 경기도 (41) — 28시 + 3군 =====
  "41111": { code: "41111", name_ko: "경기도 수원시 장안구", name_short: "수원장안" },
  "41113": { code: "41113", name_ko: "경기도 수원시 권선구", name_short: "수원권선" },
  "41115": { code: "41115", name_ko: "경기도 수원시 팔달구", name_short: "수원팔달" },
  "41117": { code: "41117", name_ko: "경기도 수원시 영통구", name_short: "수원영통" },
  "41131": { code: "41131", name_ko: "경기도 성남시 수정구", name_short: "성남수정" },
  "41133": { code: "41133", name_ko: "경기도 성남시 중원구", name_short: "성남중원" },
  "41135": { code: "41135", name_ko: "경기도 성남시 분당구", name_short: "분당구" },
  "41150": { code: "41150", name_ko: "경기도 의정부시", name_short: "의정부시" },
  "41171": { code: "41171", name_ko: "경기도 안양시 만안구", name_short: "안양만안" },
  "41173": { code: "41173", name_ko: "경기도 안양시 동안구", name_short: "안양동안" },
  "41190": { code: "41190", name_ko: "경기도 부천시", name_short: "부천시" },
  "41210": { code: "41210", name_ko: "경기도 광명시", name_short: "광명시" },
  "41220": { code: "41220", name_ko: "경기도 평택시", name_short: "평택시" },
  "41250": { code: "41250", name_ko: "경기도 동두천시", name_short: "동두천시" },
  "41271": { code: "41271", name_ko: "경기도 안산시 상록구", name_short: "안산상록" },
  "41273": { code: "41273", name_ko: "경기도 안산시 단원구", name_short: "안산단원" },
  "41281": { code: "41281", name_ko: "경기도 고양시 덕양구", name_short: "고양덕양" },
  "41285": { code: "41285", name_ko: "경기도 고양시 일산동구", name_short: "일산동구" },
  "41287": { code: "41287", name_ko: "경기도 고양시 일산서구", name_short: "일산서구" },
  "41290": { code: "41290", name_ko: "경기도 과천시", name_short: "과천시" },
  "41310": { code: "41310", name_ko: "경기도 구리시", name_short: "구리시" },
  "41360": { code: "41360", name_ko: "경기도 남양주시", name_short: "남양주시" },
  "41370": { code: "41370", name_ko: "경기도 오산시", name_short: "오산시" },
  "41390": { code: "41390", name_ko: "경기도 시흥시", name_short: "시흥시" },
  "41410": { code: "41410", name_ko: "경기도 군포시", name_short: "군포시" },
  "41430": { code: "41430", name_ko: "경기도 의왕시", name_short: "의왕시" },
  "41450": { code: "41450", name_ko: "경기도 하남시", name_short: "하남시" },
  "41461": { code: "41461", name_ko: "경기도 용인시 처인구", name_short: "용인처인" },
  "41463": { code: "41463", name_ko: "경기도 용인시 기흥구", name_short: "용인기흥" },
  "41465": { code: "41465", name_ko: "경기도 용인시 수지구", name_short: "용인수지" },
  "41480": { code: "41480", name_ko: "경기도 파주시", name_short: "파주시" },
  "41500": { code: "41500", name_ko: "경기도 이천시", name_short: "이천시" },
  "41550": { code: "41550", name_ko: "경기도 안성시", name_short: "안성시" },
  "41570": { code: "41570", name_ko: "경기도 김포시", name_short: "김포시" },
  "41590": { code: "41590", name_ko: "경기도 화성시", name_short: "화성시" },
  "41610": { code: "41610", name_ko: "경기도 광주시", name_short: "광주시(경기)" },
  "41630": { code: "41630", name_ko: "경기도 양주시", name_short: "양주시" },
  "41650": { code: "41650", name_ko: "경기도 포천시", name_short: "포천시" },
  "41670": { code: "41670", name_ko: "경기도 여주시", name_short: "여주시" },
  "41800": { code: "41800", name_ko: "경기도 연천군", name_short: "연천군" },
  "41820": { code: "41820", name_ko: "경기도 가평군", name_short: "가평군" },
  "41830": { code: "41830", name_ko: "경기도 양평군", name_short: "양평군" },

  // ===== 강원특별자치도 (51, 2023 특별자치도) — 7시 + 11군 =====
  "51110": { code: "51110", name_ko: "강원특별자치도 춘천시", name_short: "춘천시" },
  "51130": { code: "51130", name_ko: "강원특별자치도 원주시", name_short: "원주시" },
  "51150": { code: "51150", name_ko: "강원특별자치도 강릉시", name_short: "강릉시" },
  "51170": { code: "51170", name_ko: "강원특별자치도 동해시", name_short: "동해시" },
  "51190": { code: "51190", name_ko: "강원특별자치도 태백시", name_short: "태백시" },
  "51210": { code: "51210", name_ko: "강원특별자치도 속초시", name_short: "속초시" },
  "51230": { code: "51230", name_ko: "강원특별자치도 삼척시", name_short: "삼척시" },
  "51720": { code: "51720", name_ko: "강원특별자치도 홍천군", name_short: "홍천군" },
  "51730": { code: "51730", name_ko: "강원특별자치도 횡성군", name_short: "횡성군" },
  "51750": { code: "51750", name_ko: "강원특별자치도 영월군", name_short: "영월군" },
  "51760": { code: "51760", name_ko: "강원특별자치도 평창군", name_short: "평창군" },
  "51770": { code: "51770", name_ko: "강원특별자치도 정선군", name_short: "정선군" },
  "51780": { code: "51780", name_ko: "강원특별자치도 철원군", name_short: "철원군" },
  "51790": { code: "51790", name_ko: "강원특별자치도 화천군", name_short: "화천군" },
  "51800": { code: "51800", name_ko: "강원특별자치도 양구군", name_short: "양구군" },
  "51810": { code: "51810", name_ko: "강원특별자치도 인제군", name_short: "인제군" },
  "51820": { code: "51820", name_ko: "강원특별자치도 고성군", name_short: "고성군(강원)" },
  "51830": { code: "51830", name_ko: "강원특별자치도 양양군", name_short: "양양군" },

  // ===== 충청북도 (43) — 3시 + 8군 =====
  "43111": { code: "43111", name_ko: "충청북도 청주시 상당구", name_short: "청주상당" },
  "43112": { code: "43112", name_ko: "충청북도 청주시 서원구", name_short: "청주서원" },
  "43113": { code: "43113", name_ko: "충청북도 청주시 흥덕구", name_short: "청주흥덕" },
  "43114": { code: "43114", name_ko: "충청북도 청주시 청원구", name_short: "청주청원" },
  "43130": { code: "43130", name_ko: "충청북도 충주시", name_short: "충주시" },
  "43150": { code: "43150", name_ko: "충청북도 제천시", name_short: "제천시" },
  "43720": { code: "43720", name_ko: "충청북도 보은군", name_short: "보은군" },
  "43730": { code: "43730", name_ko: "충청북도 옥천군", name_short: "옥천군" },
  "43740": { code: "43740", name_ko: "충청북도 영동군", name_short: "영동군" },
  "43745": { code: "43745", name_ko: "충청북도 증평군", name_short: "증평군" },
  "43750": { code: "43750", name_ko: "충청북도 진천군", name_short: "진천군" },
  "43760": { code: "43760", name_ko: "충청북도 괴산군", name_short: "괴산군" },
  "43770": { code: "43770", name_ko: "충청북도 음성군", name_short: "음성군" },
  "43800": { code: "43800", name_ko: "충청북도 단양군", name_short: "단양군" },

  // ===== 충청남도 (44) — 8시 + 7군 =====
  "44131": { code: "44131", name_ko: "충청남도 천안시 동남구", name_short: "천안동남" },
  "44133": { code: "44133", name_ko: "충청남도 천안시 서북구", name_short: "천안서북" },
  "44150": { code: "44150", name_ko: "충청남도 공주시", name_short: "공주시" },
  "44180": { code: "44180", name_ko: "충청남도 보령시", name_short: "보령시" },
  "44200": { code: "44200", name_ko: "충청남도 아산시", name_short: "아산시" },
  "44210": { code: "44210", name_ko: "충청남도 서산시", name_short: "서산시" },
  "44230": { code: "44230", name_ko: "충청남도 논산시", name_short: "논산시" },
  "44250": { code: "44250", name_ko: "충청남도 계룡시", name_short: "계룡시" },
  "44270": { code: "44270", name_ko: "충청남도 당진시", name_short: "당진시" },
  "44710": { code: "44710", name_ko: "충청남도 금산군", name_short: "금산군" },
  "44760": { code: "44760", name_ko: "충청남도 부여군", name_short: "부여군" },
  "44770": { code: "44770", name_ko: "충청남도 서천군", name_short: "서천군" },
  "44790": { code: "44790", name_ko: "충청남도 청양군", name_short: "청양군" },
  "44800": { code: "44800", name_ko: "충청남도 홍성군", name_short: "홍성군" },
  "44810": { code: "44810", name_ko: "충청남도 예산군", name_short: "예산군" },
  "44825": { code: "44825", name_ko: "충청남도 태안군", name_short: "태안군" },

  // ===== 전북특별자치도 (52, 2024 특별자치도) — 6시 + 8군 =====
  "52111": { code: "52111", name_ko: "전북특별자치도 전주시 완산구", name_short: "전주완산" },
  "52113": { code: "52113", name_ko: "전북특별자치도 전주시 덕진구", name_short: "전주덕진" },
  "52130": { code: "52130", name_ko: "전북특별자치도 군산시", name_short: "군산시" },
  "52140": { code: "52140", name_ko: "전북특별자치도 익산시", name_short: "익산시" },
  "52180": { code: "52180", name_ko: "전북특별자치도 정읍시", name_short: "정읍시" },
  "52190": { code: "52190", name_ko: "전북특별자치도 남원시", name_short: "남원시" },
  "52210": { code: "52210", name_ko: "전북특별자치도 김제시", name_short: "김제시" },
  "52710": { code: "52710", name_ko: "전북특별자치도 완주군", name_short: "완주군" },
  "52720": { code: "52720", name_ko: "전북특별자치도 진안군", name_short: "진안군" },
  "52730": { code: "52730", name_ko: "전북특별자치도 무주군", name_short: "무주군" },
  "52740": { code: "52740", name_ko: "전북특별자치도 장수군", name_short: "장수군" },
  "52750": { code: "52750", name_ko: "전북특별자치도 임실군", name_short: "임실군" },
  "52770": { code: "52770", name_ko: "전북특별자치도 순창군", name_short: "순창군" },
  "52790": { code: "52790", name_ko: "전북특별자치도 고창군", name_short: "고창군" },
  "52800": { code: "52800", name_ko: "전북특별자치도 부안군", name_short: "부안군" },

  // ===== 전라남도 (46) — 5시 + 17군 =====
  "46110": { code: "46110", name_ko: "전라남도 목포시", name_short: "목포시" },
  "46130": { code: "46130", name_ko: "전라남도 여수시", name_short: "여수시" },
  "46150": { code: "46150", name_ko: "전라남도 순천시", name_short: "순천시" },
  "46170": { code: "46170", name_ko: "전라남도 나주시", name_short: "나주시" },
  "46230": { code: "46230", name_ko: "전라남도 광양시", name_short: "광양시" },
  "46710": { code: "46710", name_ko: "전라남도 담양군", name_short: "담양군" },
  "46720": { code: "46720", name_ko: "전라남도 곡성군", name_short: "곡성군" },
  "46730": { code: "46730", name_ko: "전라남도 구례군", name_short: "구례군" },
  "46770": { code: "46770", name_ko: "전라남도 고흥군", name_short: "고흥군" },
  "46780": { code: "46780", name_ko: "전라남도 보성군", name_short: "보성군" },
  "46790": { code: "46790", name_ko: "전라남도 화순군", name_short: "화순군" },
  "46800": { code: "46800", name_ko: "전라남도 장흥군", name_short: "장흥군" },
  "46810": { code: "46810", name_ko: "전라남도 강진군", name_short: "강진군" },
  "46820": { code: "46820", name_ko: "전라남도 해남군", name_short: "해남군" },
  "46830": { code: "46830", name_ko: "전라남도 영암군", name_short: "영암군" },
  "46840": { code: "46840", name_ko: "전라남도 무안군", name_short: "무안군" },
  "46860": { code: "46860", name_ko: "전라남도 함평군", name_short: "함평군" },
  "46870": { code: "46870", name_ko: "전라남도 영광군", name_short: "영광군" },
  "46880": { code: "46880", name_ko: "전라남도 장성군", name_short: "장성군" },
  "46890": { code: "46890", name_ko: "전라남도 완도군", name_short: "완도군" },
  "46900": { code: "46900", name_ko: "전라남도 진도군", name_short: "진도군" },
  "46910": { code: "46910", name_ko: "전라남도 신안군", name_short: "신안군" },

  // ===== 경상북도 (47) — 10시 + 12군 =====
  "47111": { code: "47111", name_ko: "경상북도 포항시 남구", name_short: "포항남구" },
  "47113": { code: "47113", name_ko: "경상북도 포항시 북구", name_short: "포항북구" },
  "47130": { code: "47130", name_ko: "경상북도 경주시", name_short: "경주시" },
  "47150": { code: "47150", name_ko: "경상북도 김천시", name_short: "김천시" },
  "47170": { code: "47170", name_ko: "경상북도 안동시", name_short: "안동시" },
  "47190": { code: "47190", name_ko: "경상북도 구미시", name_short: "구미시" },
  "47210": { code: "47210", name_ko: "경상북도 영주시", name_short: "영주시" },
  "47230": { code: "47230", name_ko: "경상북도 영천시", name_short: "영천시" },
  "47250": { code: "47250", name_ko: "경상북도 상주시", name_short: "상주시" },
  "47280": { code: "47280", name_ko: "경상북도 문경시", name_short: "문경시" },
  "47290": { code: "47290", name_ko: "경상북도 경산시", name_short: "경산시" },
  "47730": { code: "47730", name_ko: "경상북도 의성군", name_short: "의성군" },
  "47750": { code: "47750", name_ko: "경상북도 청송군", name_short: "청송군" },
  "47760": { code: "47760", name_ko: "경상북도 영양군", name_short: "영양군" },
  "47770": { code: "47770", name_ko: "경상북도 영덕군", name_short: "영덕군" },
  "47820": { code: "47820", name_ko: "경상북도 청도군", name_short: "청도군" },
  "47830": { code: "47830", name_ko: "경상북도 고령군", name_short: "고령군" },
  "47840": { code: "47840", name_ko: "경상북도 성주군", name_short: "성주군" },
  "47850": { code: "47850", name_ko: "경상북도 칠곡군", name_short: "칠곡군" },
  "47900": { code: "47900", name_ko: "경상북도 예천군", name_short: "예천군" },
  "47920": { code: "47920", name_ko: "경상북도 봉화군", name_short: "봉화군" },
  "47930": { code: "47930", name_ko: "경상북도 울진군", name_short: "울진군" },
  "47940": { code: "47940", name_ko: "경상북도 울릉군", name_short: "울릉군" },

  // ===== 경상남도 (48) — 8시 + 10군 =====
  "48121": { code: "48121", name_ko: "경상남도 창원시 의창구", name_short: "창원의창" },
  "48123": { code: "48123", name_ko: "경상남도 창원시 성산구", name_short: "창원성산" },
  "48125": { code: "48125", name_ko: "경상남도 창원시 마산합포구", name_short: "마산합포" },
  "48127": { code: "48127", name_ko: "경상남도 창원시 마산회원구", name_short: "마산회원" },
  "48129": { code: "48129", name_ko: "경상남도 창원시 진해구", name_short: "진해구" },
  "48170": { code: "48170", name_ko: "경상남도 진주시", name_short: "진주시" },
  "48220": { code: "48220", name_ko: "경상남도 통영시", name_short: "통영시" },
  "48240": { code: "48240", name_ko: "경상남도 사천시", name_short: "사천시" },
  "48250": { code: "48250", name_ko: "경상남도 김해시", name_short: "김해시" },
  "48270": { code: "48270", name_ko: "경상남도 밀양시", name_short: "밀양시" },
  "48310": { code: "48310", name_ko: "경상남도 거제시", name_short: "거제시" },
  "48330": { code: "48330", name_ko: "경상남도 양산시", name_short: "양산시" },
  "48720": { code: "48720", name_ko: "경상남도 의령군", name_short: "의령군" },
  "48730": { code: "48730", name_ko: "경상남도 함안군", name_short: "함안군" },
  "48740": { code: "48740", name_ko: "경상남도 창녕군", name_short: "창녕군" },
  "48820": { code: "48820", name_ko: "경상남도 고성군", name_short: "고성군(경남)" },
  "48840": { code: "48840", name_ko: "경상남도 남해군", name_short: "남해군" },
  "48850": { code: "48850", name_ko: "경상남도 하동군", name_short: "하동군" },
  "48860": { code: "48860", name_ko: "경상남도 산청군", name_short: "산청군" },
  "48870": { code: "48870", name_ko: "경상남도 함양군", name_short: "함양군" },
  "48880": { code: "48880", name_ko: "경상남도 거창군", name_short: "거창군" },
  "48890": { code: "48890", name_ko: "경상남도 합천군", name_short: "합천군" },

  // ===== 제주특별자치도 (50) — 2시 =====
  "50110": { code: "50110", name_ko: "제주특별자치도 제주시", name_short: "제주시" },
  "50130": { code: "50130", name_ko: "제주특별자치도 서귀포시", name_short: "서귀포시" },
};

/**
 * 법정동 코드 5자리 형식 검증.
 * v1.2 (WO-118): KNOWN_REGIONS 등록 강제 해제 — RTMS API 자체 검증에 위임.
 * 등록된 코드: KNOWN_REGIONS의 name_ko 사용.
 * 미등록 코드: 형식 검증 통과 → RTMS API 호출 → 데이터 없으면 INFO-200.
 */
export function validateRegionCode(code: string): void {
  if (!/^\d{5}$/.test(code)) {
    throw new z.ZodError([
      { code: "custom", path: ["region_code"], message: `region_code는 5자리 법정동 코드 (받은 값: ${code})` },
    ]);
  }
  // KNOWN_REGIONS 미등록 시에도 통과 — 형식만 정확하면 RTMS API에 위임
}

export function validateYearMonth(ym: string): void {
  if (!/^\d{6}$/.test(ym)) {
    throw new z.ZodError([
      { code: "custom", path: ["year_month"], message: `year_month는 YYYYMM 형식 (받은 값: ${ym})` },
    ]);
  }
}

export const RTMS_ENDPOINTS = {
  // ⚠️ WO-066 핫픽스: AptTradeDev → AptTrade (Dev는 별도 페이지, 활용신청 권한 다름).
  // 페이지 ID 15126469 (활용신청한 것) = production. Dev 버전은 별도 신청 필요.
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  villa: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  house: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
} as const;

export type PropertyType = keyof typeof RTMS_ENDPOINTS;

export interface RealEstateTrade {
  region_code: string;
  region_name: string;
  complex_name: string;
  unit_area: number;
  price: number;
  trade_date: string;
  floor?: number;
  /** 지번 (예: "736-8" 또는 "100-3"). 본번-부번 결합. v1.2부터 공개. */
  jibun?: string;
  // dong/ho 의도적 제거 — 국토부 RTMS 공식 마스킹 정책 준수
  // v1.2 (WO-116): jibun·floor 공개 — 정부 RTMS rt.molit.go.kr 공개 수준과 동일
}

export function sanitizeTrade(raw: Record<string, unknown>, regionCode: string): RealEstateTrade {
  const meta = KNOWN_REGIONS[regionCode];
  // WO-118: KNOWN_REGIONS 미등록 시 "법정동 코드 {code}" fallback (정부 RTMS 응답 그대로 반영)
  const region_name = meta?.name_ko ?? `법정동 코드 ${regionCode}`;

  const priceStr = String(raw["거래금액"] ?? raw["dealAmount"] ?? "0").replace(/,/g, "").trim();
  const year = String(raw["년"] ?? raw["dealYear"] ?? "");
  const month = String(raw["월"] ?? raw["dealMonth"] ?? "").padStart(2, "0");
  const day = String(raw["일"] ?? raw["dealDay"] ?? "").padStart(2, "0");

  const floorRaw = raw["층"] ?? raw["floor"];
  const floor = floorRaw !== undefined ? Number(floorRaw) : undefined;

  // 지번 추출 — RTMS는 본번/부번 분리 응답. "본번-부번" 형식으로 결합.
  // 정부 rt.molit.go.kr이 공개하는 동일 수준. 동·호는 정부 마스킹 정책 그대로.
  const bonbun = String(raw["본번"] ?? raw["bonbun"] ?? "").trim();
  const bubun = String(raw["부번"] ?? raw["bubun"] ?? "").trim();
  const jibunRaw = String(raw["지번"] ?? raw["jibun"] ?? "").trim();
  let jibun: string | undefined;
  if (jibunRaw) {
    jibun = jibunRaw;
  } else if (bonbun) {
    jibun = bubun && bubun !== "0" ? `${bonbun}-${bubun}` : bonbun;
  }

  return {
    region_code: regionCode,
    region_name,
    complex_name: String(raw["아파트"] ?? raw["연립다세대"] ?? raw["단독다가구"] ?? raw["apartmentName"] ?? "").trim(),
    unit_area: Number(raw["전용면적"] ?? raw["excluUseAr"] ?? 0),
    price: Number(priceStr),
    trade_date: `${year}-${month}-${day}T00:00:00Z`,
    ...(floor !== undefined && { floor }),
    ...(jibun && { jibun }),
  };
}

const RTMS_CACHE = new Map<string, { ts: number; data: RealEstateTrade[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface FetchRtmsOptions {
  property_type: PropertyType;
  region_code: string;
  year_month: string;
  api_key?: string;
}

export async function fetchRtmsTrades(opts: FetchRtmsOptions): Promise<RealEstateTrade[]> {
  validateRegionCode(opts.region_code);
  validateYearMonth(opts.year_month);

  const cacheKey = `${opts.property_type}|${opts.region_code}|${opts.year_month}`;
  const cached = RTMS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = opts.api_key ?? process.env.DATA_GO_KR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("[realestate] DATA_GO_KR_API_KEY 미설정");
  }

  const endpoint = RTMS_ENDPOINTS[opts.property_type];
  const url = `${endpoint}?serviceKey=${apiKey}&LAWD_CD=${opts.region_code}&DEAL_YMD=${opts.year_month}&pageNo=1&numOfRows=100`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[realestate] RTMS API HTTP ${res.status}`);
  }
  const text = await res.text();

  const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const trades: RealEstateTrade[] = [];
  for (const item of itemMatches) {
    const raw: Record<string, unknown> = {};
    // WO-120 핫픽스: \w → [^>\s/]+ (한글 XML 태그 매칭 가능)
    //   기존 \w는 ASCII alphanumeric만 매치 → RTMS의 <아파트>·<거래금액>·<년> 등 *전부 매칭 실패*
    //   결과: 100건 모두 빈 값 + price=0 + trade_date="--00-00T..." 반환되던 잠재 버그
    const fields = item.match(/<([^>\s/]+)>([\s\S]*?)<\/\1>/g) ?? [];
    for (const f of fields) {
      const m = f.match(/<([^>\s/]+)>([\s\S]*?)<\/\1>/);
      const key = m?.[1];
      const value = m?.[2];
      if (key && value !== undefined) {
        raw[key] = value.trim();
      }
    }
    trades.push(sanitizeTrade(raw, opts.region_code));
  }

  RTMS_CACHE.set(cacheKey, { ts: Date.now(), data: trades });
  return trades;
}

export function _mockRtmsTrade(overrides: Partial<RealEstateTrade> = {}): RealEstateTrade {
  return {
    region_code: "11680",
    region_name: "서울특별시 강남구",
    complex_name: "Mock 아파트",
    unit_area: 84.5,
    price: 250000,
    trade_date: "2024-05-15T00:00:00Z",
    floor: 10,
    jibun: "736-8",
    ...overrides,
  };
}