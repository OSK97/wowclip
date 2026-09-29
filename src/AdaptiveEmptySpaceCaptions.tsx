import React from 'react';
import { AdaptiveCaptions, AdaptiveCaptionsProps } from './AdaptiveCaptions';

export type AdaptiveEmptySpaceCaptionsProps = AdaptiveCaptionsProps & {
	placementMode?: 'alternate' | 'right-only' | 'left-only';
};

export const AdaptiveEmptySpaceCaptions: React.FC<AdaptiveEmptySpaceCaptionsProps> = (props) => {
	return <AdaptiveCaptions {...props} />;
};

export default AdaptiveEmptySpaceCaptions;
