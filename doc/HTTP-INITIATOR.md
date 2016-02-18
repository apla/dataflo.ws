
http initiator flow options:

 * flows — flow descriptions for a deeper paths in uri
 * path - direct match of url chunk
 * pattern - pattern match of url chunk, every match goes to `request.capture` array
 * pathInfo - if we have unmatched chunks, when pathInfo is false or not present
empty flow is returned. In most cases this lead to the 404 response or 404 handler.
If `pathInfo` is set, all unmatched path chunks concatenated and put into `request.pathInfo`
