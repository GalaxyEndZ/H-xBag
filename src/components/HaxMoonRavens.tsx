/**
 * Häx — Observatório das Sombras.
 * Gravura vetorial desenhada em SVG inline. Os corvos têm anatomia de perfil:
 * bico robusto, penas da garganta, asas dobradas, cauda longa e patas no parapeito.
 * Sem imagens raster e sem eventos interativos.
 */
function RavenEngraving() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* Cauda em cunha, projetada além do corpo. */}
      <g fill="#111219" stroke="#6C5264" strokeWidth="1.25">
        <path d="M140 235Q113 255 68 294Q88 293 106 286Q86 302 75 312Q113 302 146 271L156 249Z" />
        <path d="M135 252Q112 276 86 300M144 257Q119 284 99 298" fill="none" stroke="#866678" strokeWidth="1" opacity=".7"/>
      </g>
      {/* Corpo, pescoço e cabeça: uma única silhueta orgânica. */}
      <path
        d="M118 237C117 212 129 181 147 164C156 156 163 153 172 150C169 143 169 137 174 131C182 122 195 126 202 133C210 138 215 144 217 150L239 155Q244 157 239 161L218 166C209 168 205 171 202 180L207 189L201 188L205 197L198 194L201 204L192 198C192 218 185 241 172 254C159 269 136 271 124 257C120 252 118 244 118 237Z"
        fill="#101118" stroke="#886575" strokeWidth="1.6"
      />
      {/* Volume sombreado da cabeça, aro de penas do pescoço e separação do bico. */}
      <path d="M175 149Q187 142 200 150Q207 159 205 175Q195 192 192 199Q188 187 178 179Q171 164 175 149Z" fill="#20202B" opacity=".8"/>
      <path d="M210 159Q221 156 239 158M204 168Q210 170 215 167" fill="none" stroke="#A3848C" strokeWidth="1.15" opacity=".72"/>
      <path d="M182 175Q186 182 179 189L188 187L181 194L189 192L185 199" fill="none" stroke="#685060" strokeWidth="1.4" opacity=".9"/>
      {/* Olho pequeno: suficientemente legível também na miniatura. */}
      <circle cx="195" cy="146" r="3.5" fill="#B98786"/>
      <circle cx="195.7" cy="145.7" r="1.65" fill="#0C0B11"/>
      <circle cx="196.2" cy="145.1" r=".65" fill="#FFE2C5"/>
      {/* Asa recolhida, com primárias alongadas e secundárias separadas. */}
      <path
        d="M152 172C136 177 124 195 126 221C127 240 119 254 99 277Q115 276 124 272Q118 282 111 290Q139 285 153 266C169 246 177 220 177 199Q173 178 152 172Z"
        fill="#252330" stroke="#866275" strokeWidth="1.4"
      />
      <path d="M152 177Q159 196 155 217Q146 248 119 275M161 181Q169 203 160 232Q153 251 135 269M169 190Q173 215 161 241" fill="none" stroke="#6F596F" strokeWidth="1.6" opacity=".92"/>
      <path d="M136 196Q144 206 145 220M130 216Q137 228 135 243M128 240Q133 247 129 257" fill="none" stroke="#B08B92" strokeWidth=".9" opacity=".5"/>
      {/* Tarso e garras sobre o parapeito. */}
      <g fill="none" stroke="#B08D93" strokeWidth="3">
        <path d="M149 255L149 279Q144 282 139 281Q136 279 138 276" />
        <path d="M168 250L174 278Q180 283 185 280Q187 278 185 275" />
      </g>
      <g fill="none" stroke="#171118" strokeWidth="2.3">
        <path d="M149 279Q155 283 161 281M149 280Q145 285 141 286M174 279Q168 284 164 283M174 279Q178 284 183 284" />
      </g>
    </g>
  )
}

export default function HaxMoonRavens({ className = '' }: { className?: string }) {
  return (
    <svg className={`hx-moon-ravens ${className}`} viewBox="0 0 560 360" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="obs-halo"><stop stopColor="#BD4A55" stopOpacity=".6"/><stop offset=".55" stopColor="#8C3348" stopOpacity=".18"/><stop offset="1" stopColor="#8C3348" stopOpacity="0"/></radialGradient>
        <linearGradient id="obs-moon" x1="227" y1="68" x2="354" y2="229" gradientUnits="userSpaceOnUse"><stop stopColor="#F2C8AD"/><stop offset=".4" stopColor="#D47F82"/><stop offset="1" stopColor="#852C46"/></linearGradient>
      </defs>
      {/* Ogiva do observatório e frisos. */}
      <g stroke="#C7A28D" strokeWidth="1.5" strokeLinejoin="round" opacity=".84">
        <path d="M154 311V132Q154 81 280 16Q406 81 406 132V311"/>
        <path d="M172 293V140Q172 93 280 38Q388 93 388 140V293" opacity=".55"/>
        <path d="M140 311H420M168 322H392M202 333H358"/>
        <path d="M280 8V29M267 20H293M154 143L133 133L154 123M406 143L427 133L406 123"/>
        <path d="M182 111L203 123M378 111L357 123M172 276H206M354 276H388" opacity=".48"/>
        <path d="M280 25L288 36L280 47L272 36Z" fill="#C7A28D"/>
      </g>
      <circle cx="280" cy="163" r="145" fill="url(#obs-halo)"/>
      <circle cx="280" cy="163" r="112" stroke="#C7A28D" strokeOpacity=".5" strokeWidth="1.3" strokeDasharray="2 9"/>
      <circle cx="280" cy="163" r="88" fill="url(#obs-moon)" stroke="#F0BEAA" strokeWidth="1.8"/>
      <g fill="#723149" opacity=".24"><circle cx="250" cy="125" r="17"/><circle cx="316" cy="171" r="28"/><circle cx="253" cy="197" r="15"/><circle cx="304" cy="109" r="10"/></g>
      <path d="M251 78C221 113 218 176 255 213C276 235 313 247 334 231C298 243 258 225 241 190C226 159 235 107 251 78Z" fill="#57233A" opacity=".26"/>
      {/* Um par de corvos pousados, voltados à lua, em vez de asas artificiais espalmadas. */}
      <g>
        <path d="M72 280Q144 277 227 283M333 283Q416 277 488 280" stroke="#AE8A89" strokeWidth="2.5" opacity=".75"/>
        <path d="M75 283L90 287L108 285L128 288L144 285L163 287L189 285L226 288M334 288L371 285L397 287L416 285L432 288L452 285L470 287L485 283" stroke="#70505E" strokeWidth="1.1" opacity=".8"/>
        <RavenEngraving />
        <g transform="translate(560 0) scale(-1 1)"><RavenEngraving /></g>
      </g>
      {/* Olho do oráculo preservado. */}
      <g transform="translate(280 293)">
        <path d="M-57 0Q0 -45 57 0Q0 45 -57 0Z" fill="#20131F" stroke="#D4A593" strokeWidth="2"/>
        <path d="M-39 0Q0 -27 39 0Q0 27 -39 0Z" fill="#9D4855" stroke="#D4A593" strokeWidth="1.2"/>
        <circle r="19" fill="#E0A39A"/><circle r="11" fill="#311520"/><path d="M0 -12V12" stroke="#EFC3AE" strokeWidth="3" strokeLinecap="round"/>
        <path d="M0 -48V-30M0 30V48M-78 0H-62M62 0H78" stroke="#D4A593" strokeWidth="1.5"/>
        <path d="M0 -59L6 -52L0 -45L-6 -52Z" fill="#D4A593"/>
      </g>
      <g stroke="#C7A28D" strokeWidth="1.3" opacity=".7"><path d="M95 92L103 103L95 114L87 103ZM465 92L473 103L465 114L457 103Z"/><path d="M94 316H135M425 316H466"/></g>
    </svg>
  )
}
